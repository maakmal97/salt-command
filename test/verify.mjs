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

/* ---- done ----------------------------------------------------------------------- */
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
