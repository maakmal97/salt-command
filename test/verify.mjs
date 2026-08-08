/* verify.mjs — smoke tests for the new cloud surface.
 *
 * Covers the risky new code: the Worker's queue contract against a KV mock, the build's
 * patch integrity and script validity, and the drain's pure helpers. The desk's own
 * rendering is tested by the daily run's jsdom pass; this suite guards the cloud plumbing.
 * No network, no browser: `npm test` runs it in a couple of seconds.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
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

/* ---- 2. Worker: names never persist -------------------------------------------- */
section("Worker — names never touch the cloud");
{
  const kv = new KV(), env = mkEnv(kv);
  let r = await worker.fetch(req("/vault"), env); let j = await r.json();
  ok(j.ok && j.vault === null && !("ids" in j), "GET /vault → {vault:null} with no ids (won't clobber device)");
  r = await worker.fetch(req("/bio"), env); j = await r.json();
  ok(j.ok && JSON.stringify(j.bio) === "{}", "GET /bio → empty bio");

  await worker.fetch(req("/vault", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vault: { salt: "s", iv: "i", ct: "c" } }) }), env);
  await worker.fetch(req("/bio", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bio: { A26: { raw: "a real name" } } }) }), env);
  ok([...kv.m.keys()].every(k => k.startsWith("q:")), "no vault/bio key ever written to KV");
  ok(![...kv.m.values()].join("").includes("a real name"), "a posted name is not stored anywhere in KV");
}

/* ---- 3. Worker: access gate + routing ------------------------------------------ */
section("Worker — access gate and routing");
{
  let kv = new KV();
  let r = await worker.fetch(postQ({ device: "d1", queue: [] }), mkEnv(kv, "1"));
  ok(r.status === 401, "REQUIRE_ACCESS=1 without Access header → 401");
  r = await worker.fetch(postQ({ device: "d1", queue: [] }, { "Cf-Access-Jwt-Assertion": "jwt" }), mkEnv(kv, "1"));
  ok(r.status === 200, "REQUIRE_ACCESS=1 with Access header → 200");

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
    const html = readFileSync(join(REPO, "public", "index.html"), "utf8");
    ok(html.includes("BEGIN cloud/PWA"), "PWA head block injected");
    ok(html.includes('<link rel="manifest"'), "manifest linked");
    ok(html.includes("serviceWorker") && html.includes("register('sw.js')"), "service worker registered");
    ok(html.includes("function saltDeviceId"), "device id helper present");
    ok(html.includes("cloud &middot; pushes to source"), "cloud badge present");
    ok(html.includes("device:(typeof saltDeviceId"), "qPayload carries the device id");
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
  }
}

/* ---- done ----------------------------------------------------------------------- */
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
