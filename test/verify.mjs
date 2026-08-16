/* verify.mjs — smoke tests for the new cloud surface.
 *
 * Covers the risky new code: the Worker's queue contract against a KV mock, the build's
 * patch integrity and script validity, and the drain's pure helpers. The desk's own
 * rendering is tested by the daily run's jsdom pass; this suite guards the cloud plumbing.
 * No network, no browser: `npm test` runs it in a couple of seconds.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../src/worker.js";
import { unionByAt, pruneCommitted } from "../tools/drain.mjs";

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
    if (p === "/") return new Response("SPA-INDEX", { status: 200 });
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

  /* Reads stay open. This is the owner's standing decision and the gate must not creep. */
  r = await worker.fetch(req("/queue"), armed(kv));
  ok(r.status === 200, "armed: GET /queue is still open");
  r = await worker.fetch(req("/queue/ping"), armed(kv));
  ok(r.status === 200, "armed: the ping is still open");
  r = await worker.fetch(req("/index.html"), armed(kv));
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
  const data = JSON.parse(readFileSync(join(REPO, "public", "data.json"), "utf8"));
  ok(data.products[0].id === "salt", "the phone payload lists salt first");
  ok(Object.keys(data.position)[0] === "salt", "and reports the salt position first");
  const app = readFileSync(join(REPO, "public", "index.html"), "utf8");
  ok(app.includes("(D.products||[]).map") || app.includes("(D.products || []).map"),
     "the app renders products in the payload's order rather than choosing its own");

  /* The name gate must exist and must be capable of failing. Nothing may be committed to
     this repo carrying a real name, and the extract is a committed artefact. */
  ok(/salt_bio\.json/.test(tool), "the extract checks itself against the real directory for names");
  ok(/no real name or place|carries \$\{|carries .* real name/.test(tool), "the name gate reports a verdict either way");
}

/* ---- 1e. No directory name or place may reach the public desk (v293) ------------- */
section("The public desk carries no name and no place");
{
  const BIO = "C:/Users/maakm/Claude/Projects/Personal/Cow-Crm01_Salt Business/06_Data/salt_bio.json";
  if (!existsSync(BIO)) {
    ok(true, "salt_bio.json is not on this machine, so the name scan is skipped");
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
    const skip = new Set(["tbc", "unknown"]);
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

/* ---- 1c. The phone app at the root, the desk at /desk (v290) --------------------- */
section("The phone app, and the desk at /desk");
{
  const kv = new KV(), env = mkEnv(kv);

  let r = await worker.fetch(req("/desk"), env);
  ok(r.status === 200, "GET /desk answers");
  ok((await r.text()) === "ASSET:/desk.html", "and it serves desk.html, not the root");

  const app = readFileSync(join(REPO, "public", "index.html"), "utf8");

  /* The root must be the APP. If a stray build ever writes the desk here again, every
     one of these fails at once rather than the phone quietly loading 900 KB. */
  ok(!app.includes("BEGIN cloud/PWA"), "the root is the app, not the built desk");
  ok(app.length < 60 * 1024, `the app is small (${(app.length / 1024).toFixed(0)} KB, the desk is ~900 KB)`);
  ok(app.includes("fetch('data.json'"), "the app reads its figures from data.json");
  ok(app.includes("X-Salt-Key"), "the app sends the write key");
  ok(app.includes("queueCommitted"), "the app self-clears against the watermark");
  ok(app.includes('href="./desk"'), "the app links to the full desk");
  ok(!/\bsrc\s*=\s*["']https?:\/\//i.test(app) && !/url\(\s*["']?https?:\/\//i.test(app),
     "the app loads nothing off a third-party origin");
  ok(/lang="en-GB"/.test(app), "the app declares en-GB");
  ok(app.indexOf("—") < 0, "the app carries no em-dash");

  /* THE PAYLOAD CONTRACT. The app holds an entry until the watermark passes it, so a
     data.json without queueCommitted would make it re-post committed rows for ever. */
  const data = JSON.parse(readFileSync(join(REPO, "public", "data.json"), "utf8"));
  ok("queueCommitted" in data, "data.json carries the queue watermark");
  ok(typeof data.rev === "string" && data.rev.length === 16, "data.json carries the build id");
  ok(Array.isArray(data.parties) && Array.isArray(data.suppliers), "data.json carries both party lists");
  ok(data.position && data.position.salt && data.position.oil, "data.json carries both books");

  /* The service worker must never cache the figures or mistake /desk for the shell. */
  const sw = readFileSync(join(REPO, "public", "sw.js"), "utf8");
  ok(/data\\?\.json/.test(sw), "sw.js never caches data.json");
  ok(sw.includes('url.pathname === "/"'), "sw.js caches only the root as the offline shell");

  // the app's inline script must parse
  mkdirSync(join(REPO, "test", "tmp"), { recursive: true });
  const m = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/i.exec(app);
  const f = join(REPO, "test", "tmp", "app.js");
  writeFileSync(f, m ? m[1] : "");
  let appOk = true;
  try { execFileSync("node", ["--check", f], { stdio: "pipe" }); } catch (e) { appOk = false; }
  ok(appOk, "the app's inline script parses");
  rmSync(join(REPO, "test", "tmp"), { recursive: true, force: true });
}

/* ---- 2. Worker: vault syncs ciphertext, plaintext never does -------------------- */
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
  ok(r.status === 200 && (await r.text()) === "SPA-INDEX", "missing path falls back to SPA index");
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

    /* the id must actually move when the master does, or the poll can never fire */
    const bumped = html.replace("</body>", "<!-- x --></body>");
    ok(createHash("sha256").update(bumped).digest("hex").slice(0, 16) !== rev.id,
      "a changed build produces a different id");
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
    constructor() { this.rows = new Map(); }
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
          if (!/^SELECT .* FROM draft/.test(s)) throw new Error("unmocked all(): " + s);
          let out = [...self.rows.values()];
          if (/status=\?/.test(s)) out = out.filter(r => r.status === binds[0]);
          if (/committed_at IS NULL/.test(s)) out = out.filter(r => !r.committed_at);
          return { results: out };
        },
        async run() {
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

  /* reads are open, matching the rest of the Worker */
  r = await worker.fetch(req("/drafts"), env);
  j = await r.json();
  ok(r.status === 200 && j.count === 1, "GET /drafts is open and lists the pending draft");
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
  r = await worker.fetch(req("/drafts?status=approved"), env);
  j = await r.json();
  ok(j.drafts[0].status === "approved", "the first decision stands after the second is refused");

  /* what the commit run asks for */
  r = await worker.fetch(req("/drafts?status=approved&uncommitted=1"), env);
  j = await r.json();
  ok(j.count === 1, "approved and uncommitted is what the commit run reads");
  r = await worker.fetch(post("/drafts/" + encodeURIComponent(goodDraft.id) + "/committed", {}, KEY), env);
  ok(r.status === 200, "the run can mark a row committed");
  r = await worker.fetch(req("/drafts?status=approved&uncommitted=1"), env);
  j = await r.json();
  ok(j.count === 0, "a committed row is no longer offered to the run");

  /* a rejected row is never offered */
  const second = { ...goodDraft, id: "2026-08-14T12:42:33.844Z" };
  await worker.fetch(post("/drafts", second, KEY), env);
  await worker.fetch(post("/drafts/" + encodeURIComponent(second.id) + "/reject", {}, KEY), env);
  r = await worker.fetch(req("/drafts?status=approved&uncommitted=1"), env);
  j = await r.json();
  ok(j.count === 0, "a rejected row never reaches the commit run");
  r = await worker.fetch(post("/drafts/" + encodeURIComponent(second.id) + "/committed", {}, KEY), env);
  ok(r.status === 409, "a rejected row cannot be marked committed");

  /* unknown ids and methods */
  r = await worker.fetch(post("/drafts/nope/approve", {}, KEY), env);
  ok(r.status === 404, "deciding an unknown id is a 404");
  r = await worker.fetch(req("/drafts", { method: "DELETE" }), env);
  ok(r.status === 405, "DELETE /drafts is not allowed");

  /* Access still gates the whole surface when it is on */
  const gated = { ...env, REQUIRE_ACCESS: "1" };
  r = await worker.fetch(req("/drafts"), gated);
  j = await r.json();
  ok(r.status === 401 && j.ok === false, "with Access on, /drafts answers 401 JSON rather than the locked page");
}

/* ---- 9. The phone app's approval panel ------------------------------------------ */
section("App — the approval panel");
{
  const app = readFileSync(join(REPO, "public", "index.html"), "utf8");
  ok(/id="tab-appr"/.test(app), "the app has an Approve tab");
  ok(/id="p-appr"/.test(app), "the app has an Approve panel");
  ok(/'tab-appr','p-appr'/.test(app), "the Approve tab is wired into TABS");
  ok(/function decide\(/.test(app), "the app can post a decision");
  ok(/drafts\/'\+encodeURIComponent\(id\)/.test(app), "the decision url encodes the id");
  /* the bug this caught in review: msg() writes into the Add panel, which is hidden
     while approving, so the Approve panel needs its own target */
  ok(/function amsg\(/.test(app) && /id="apprMsg"/.test(app), "the Approve panel reports into its own box");
  const decideBody = app.slice(app.indexOf("function decide("), app.indexOf("/* ---- tabs"));
  ok(!/(^|[^a-z])msg\('/.test(decideBody.replace(/amsg\('/g, "")), "decide() never reports into the hidden Add panel");
  ok(/X-Salt-Key/.test(app), "the app sends the write key");
  /* the self-test caught this one: a cached /drafts shows rows that are already decided */
  const sw2 = readFileSync(join(REPO, "public", "sw.js"), "utf8");
  const api2 = (sw2.match(/const API = (\/.*\/);/) || [])[1];
  ok(!!api2, "sw.js still has an API pattern");
  if (api2) {
    const rx2 = new RegExp(api2.slice(1, api2.lastIndexOf("/")));
    ok(rx2.test("/drafts"), "sw.js never caches /drafts");
    ok(rx2.test("/drafts/abc/approve"), "sw.js never caches a decision");
  }
  /* it must not price anything itself: the whole reason data.json exists */
  ok(!/floorTotal|replCost|STOCK_COST/.test(app), "the app computes no floor of its own");
  /* a flagged row must never show a green margin: green says nothing needs looking at */
  ok(/d\.flags&&d\.flags\.length&&band==='good'\)\?'warn':band/.test(app.replace(/\s/g, "")) ||
     /flags\.length&&band==='good'/.test(app.replace(/\s/g, "")),
    "a flagged row's margin is never painted green");
}

/* ---- 10. the cloud drafter ------------------------------------------------------ */
/* The cases worth testing are the REFUSALS and the FLAGS. A row that is merely correct tells
   nobody anything; the value is in what the drafter declines to write and what it insists on
   pointing at. The RM115 oil unit is the fixture, because it is the one that happened. */
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
  ok(/amends/.test(draftRow({ at: "x", payload: { mode: "amend", direction: "SELL", party: "CC5-OKR" } }, book).skip || ""), "an amendment is left for a person");
  ok(/bucket/.test(draftRow(entry({ direction: "SELL", party: "CN6-WM-R", qty: 1, total: 100, assoc: "CN6-WM" }), book).skip || ""),
    "an entry carrying associate or stream fields is left for a person");
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
  ok(cut.flags.some(f => /under the delivered floor/.test(f)), "and RM80 is flagged as under the RM85.75 delivered floor");
  ok(cut.flags.some(f => /clears the collected floor/.test(f)), "with the collected floor reported, because it does clear that");

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

/* ---- done ----------------------------------------------------------------------- */
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
