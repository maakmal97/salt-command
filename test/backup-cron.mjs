/* test/backup-cron.mjs: S0b of the Book plan. THE DESK'S SCHEDULE AND THE NIGHTLY BACKUP (src/worker.js, src/backup.js).
 *
 * The backup has a cron of its own and runs nothing else; the every-minute work never runs it; and the 09:00 morning digest, which
 * pushes only when something is worth saying, hears of a backup that failed or stopped. The Worker is the real one over a real
 * migrated SQLite; R2 and KV are fakes. Every check was proved red by its own mutation (test/backup-cron.mutations.json, run with
 * tools/section.mjs). Every id and word here is invented. */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";

class KV {
  constructor() { this.m = new Map(); }
  async put(k, v) { this.m.set(k, v); }
  async get(k, type) { if (!this.m.has(k)) return null; const raw = this.m.get(k); return type === "json" ? JSON.parse(raw) : raw; }
  async delete(k) { this.m.delete(k); }
  async list({ prefix = "" } = {}) { return { keys: [...this.m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
}
class R2 {
  constructor() { this.m = new Map(); this.puts = 0; }
  async put(k, body) { this.m.set(k, body); this.puts++; }
  async head(k) { const b = this.m.get(k); return b === undefined ? null : { size: new TextEncoder().encode(b).length }; }
  async list({ prefix = "" } = {}) { return { objects: [...this.m.keys()].filter((k) => k.startsWith(prefix)).sort().map((key) => ({ key })), truncated: false }; }
  async delete(keys) { for (const k of [].concat(keys)) this.m.delete(k); }
}

export async function run({ ok }) {
  const desk = (await import("../src/worker.js")).default, B = await import("../src/backup.js");
  const ECDH = { name: "ECDH", namedCurve: "P-256" };
  const pair = await crypto.subtle.generateKey(ECDH, true, ["deriveBits"]), pj = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const sig = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const vapid = { VAPID_PUBLIC_KEY: "pub", VAPID_SUBJECT: "mailto:a@b.test", VAPID_PRIVATE_JWK: JSON.stringify(await crypto.subtle.exportKey("jwk", sig.privateKey)) };
  const J = JSON.stringify;

  const world = async (withBucket = true) => {
    const db = new DatabaseSync(":memory:"), dir = new URL("../migrations/", import.meta.url);
    for (const f of readdirSync(dir).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(new URL(f, dir), "utf8"));
    const d1 = { prepare(sql) { const st = db.prepare(sql), bind = (a) => ({ all: () => ({ results: st.all(...a), success: true }), first: () => st.get(...a) ?? null, run: () => ({}) });
        return { ...bind([]), bind: (...a) => bind(a) }; },
      batch(stmts) { db.exec("BEGIN"); try { const out = stmts.map((s) => s.all()); db.exec("COMMIT"); return out; } catch (e) { db.exec("ROLLBACK"); throw e; } } };
    const kv = new KV(), r2 = new R2(), calls = { assets: 0 };
    const env = Object.assign({ SALT_LEDGER: d1, SALT_QUEUE: kv, REQUIRE_ACCESS: "0", BACKUP_PUBLIC_JWK: J(pj),
      ASSETS: { fetch: async () => { calls.assets++; return new Response("{}", { status: 404 }); } } }, vapid);
    if (withBucket) env.BACKUP = r2;
    return { env, kv, r2, calls };
  };
  const tick = async (env, cron, iso) => {
    const waits = [], realL = console.log, logs = [], realF = globalThis.fetch, hit = [];
    console.log = (...x) => logs.push(x.join(" "));
    globalThis.fetch = async (u) => { hit.push(String(u)); return new Response("", { status: 201 }); };
    try { await desk.scheduled({ cron, scheduledTime: Date.parse(iso) }, env, { waitUntil: (p) => waits.push(p) }); await Promise.all(waits); }
    finally { console.log = realL; globalThis.fetch = realF; }
    return { logs, pushes: hit.filter((u) => u.startsWith("https://push.example/")) };
  };

  /* A. THE BACKUP'S OWN CRON RUNS THE BACKUP AND NOTHING ELSE */
  ok(B.BACKUP_CRON === "30 18 * * *" && !B.BACKUP_CRON.startsWith("0 1 "), "the backup's cron is 18:30 UTC, 02:30 in Kuala Lumpur, and is not the 09:00 digest's: " + B.BACKUP_CRON);
  const a = await world();
  const ra = await tick(a.env, B.BACKUP_CRON, "2026-10-24T18:30:00Z");
  const last = await a.kv.get(B.BACKUP_LAST, "json");
  ok(a.r2.m.has("backup/2026-10-25.json") && last && last.ok === true && ra.logs.some((l) => /^backup: .*"ok":true/.test(l)),
    "the backup cron files the night's object, records it and logs it: " + J({ keys: [...a.r2.m.keys()], last, logs: ra.logs.slice(0, 3) }));
  ok(a.calls.assets === 0, "and runs none of the every-minute work: the minute's read of the build id never happens (" + a.calls.assets + " reads)");
  const b = await world();
  await tick(b.env, "* * * * *", "2026-10-24T18:30:00Z");
  ok(b.r2.puts === 0 && !(await b.kv.get(B.BACKUP_LAST)), "the every-minute cron never runs the backup, even at 18:30 UTC, even with a bucket bound");
  const c = await world(false);
  const rc = await tick(c.env, B.BACKUP_CRON, "2026-10-24T18:30:00Z");
  ok(rc.logs.some((l) => /backup: .*skipped.*no bucket bound/.test(l)) && !(await c.kv.get(B.BACKUP_LAST)) && c.calls.assets === 0,
    "with no bucket bound the backup cron says so in the log, records nothing and runs nothing else: " + J(rc.logs.slice(0, 3)));

  /* B. THE MORNING DIGEST HEARS OF A BACKUP THAT FAILED OR STOPPED */
  const digest = async (record, withBucket = true) => {
    const w = await world(withBucket);
    await w.kv.put("push:aa11", J({ endpoint: "https://push.example/his-phone" }));
    if (record) await w.kv.put(B.BACKUP_LAST, J(record));
    return tick(w.env, "0 1 * * *", "2026-10-25T01:00:00Z");
  };
  const fresh = { ok: true, at: "2026-10-24T18:30:05Z" }, stale = { ok: true, at: "2026-10-23T02:00:00Z" }, failed = { ok: false, at: "2026-10-24T18:30:05Z", error: "R2 said no" };
  const d0 = await digest(fresh), d1 = await digest(stale), d2 = await digest(failed), d3 = await digest(null), d4 = await digest(stale, false);
  ok(d0.pushes.length === 0 && d0.logs.some((l) => /nothing worth saying/.test(l)), "a good backup from last night leaves the digest quiet: " + J(d0.logs.slice(0, 3)));
  ok(d1.pushes.length === 1 && d1.logs.some((l) => /backup alarm: .*36 hours/.test(l)), "a backup more than 36 hours old makes the digest worth sending: " + J(d1.logs.slice(0, 3)));
  ok(d2.pushes.length === 1 && d2.logs.some((l) => /backup alarm: the last backup failed: R2 said no/.test(l)), "a failed backup makes the digest worth sending, and the log says why");
  ok(d3.pushes.length === 1 && d3.logs.some((l) => /never run/.test(l)), "a bucket with no record yet makes the digest worth sending: it has never run");
  ok(d4.pushes.length === 0, "with no bucket bound the digest says nothing of backups, however old the record: nothing was promised");

  /* C. THE CONFIG: THE CRON AND THE BUCKET ARRIVE TOGETHER, OR NOT AT ALL */
  const cfg = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, ""));
  const hasCron = (cfg.triggers.crons || []).includes(B.BACKUP_CRON), hasBucket = (cfg.r2_buckets || []).some((x) => x.binding === "BACKUP");
  ok(hasCron === hasBucket, "wrangler.jsonc lists the backup cron if and only if it binds the BACKUP bucket: a cron with no bucket logs and does nothing, a bucket with no cron is never written: " + J({ hasCron, hasBucket }));
}
