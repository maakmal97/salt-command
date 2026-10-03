import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import E from "../engine/position.mjs";
import { readVaultPair, commitVaultPair, consumeVaultOutbox } from "../src/vault-pair.js";
import worker from "../src/worker.js";
import { handleMaker } from "../stmt/maker.js";
import { bootstrapPlan, rollbackExport, pruneReceipts } from "../tools/vault-maintenance.mjs";

export async function run({ ok }) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../migrations/0015_vault_pair.sql", import.meta.url), "utf8"));
  sqlite.exec(readFileSync(new URL("../migrations/0016_vault_write_gate.sql", import.meta.url), "utf8"));
  let failBatch = false;
  const db = {
    prepare(sql) {
      const stmt = sqlite.prepare(sql);
      const bound = (args) => ({ run() { return { meta: { changes: Number(stmt.run(...args).changes) } }; },
        first() { return stmt.get(...args) || null; }, all() { return { results: stmt.all(...args) }; } });
      return { ...bound([]), bind: (...args) => bound(args) };
    },
    batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const result = statements.map((statement, index) => {
          if (failBatch && index === 2) throw new Error("outbox fixture failure");
          return statement.run();
        });
        sqlite.exec("COMMIT");return result;
      } catch (error) { sqlite.exec("ROLLBACK");throw error; }
    }
  };
  const seal = (text) => ({ v: 1, salt: Buffer.alloc(16).toString("base64"),
    iv: Buffer.alloc(12).toString("base64"), ct: Buffer.from(text.padEnd(16, ".")).toString("base64") });
  const pair = (at, expectedRevision, label) => ({ at, expectedRevision, names: seal("names-" + label), places: seal("places-" + label) });
  try {
    ok((await readVaultPair(db)).status === 503,
      "versioned vault does not silently bootstrap or adopt legacy KV authority");
    sqlite.prepare("INSERT INTO vault_pair(one,revision,names,places,updated) VALUES (1,1,?,?,?)")
      .run(JSON.stringify(seal("original-names")), JSON.stringify(seal("original-places")), "2026-10-01T00:00:00.000Z");
    const first = pair("2026-10-01T01:00:00.000Z", 1, "first");
    const changed = await commitVaultPair(db, first, "seed");
    const retry = await commitVaultPair(db, first, "seed");
    const contentConflict = await commitVaultPair(db, { ...first, names: seal("changed") }, "seed");
    const reading = await readVaultPair(db);
    ok(changed.ok && changed.revision === 2 && retry.ok && retry.replay && contentConflict.status === 409
      && JSON.stringify(reading.names) === JSON.stringify(first.names)
      && JSON.stringify(reading.places) === JSON.stringify(first.places),
      "vault pair CAS swaps both envelopes once and verifies the whole retry fingerprint before replaying success");
    for (const label of ["disjoint", "overlapping"]) {
      const revision = (await readVaultPair(db)).revision;
      const left = pair("2026-10-01T02:0" + (label === "disjoint" ? "0" : "1") + ":00.000Z", revision, label + "-left");
      const right = pair("2026-10-01T02:0" + (label === "disjoint" ? "0" : "1") + ":00.001Z", revision, label + "-right");
      const entry = (body) => E.addIdEntry({ at: body.at, code: "CX1-ZED", kind: "customer" });
      const result = await Promise.all([commitVaultPair(db, left, "add-id", entry(left)),
        commitVaultPair(db, right, "add-id", entry(right))]);
      const loser = result[0].ok ? right : left, winner = result[0].ok ? left : right;
      const current = await readVaultPair(db);
      ok(result.filter((item) => item.ok).length === 1 && result.some((item) => item.status === 409)
        && !sqlite.prepare("SELECT id FROM vault_receipt WHERE id=?").get(loser.at)
        && !sqlite.prepare("SELECT id FROM vault_outbox WHERE id=?").get(loser.at)
        && current.revision === revision + 1
        && JSON.stringify(current.names) === JSON.stringify(winner.names)
        && JSON.stringify(current.places) === JSON.stringify(winner.places),
        "concurrent " + label + " ciphertext edits yield one consistent pair and no losing CAS receipt or outbox");
    }
    const before = await readVaultPair(db), broken = pair("2026-10-01T03:00:00.000Z", before.revision, "broken");
    failBatch = true;
    let rollback = false;
    try { await commitVaultPair(db, broken, "add-id", E.addIdEntry({ at: broken.at, code: "CX2-ZED", kind: "customer" })); }
    catch (error) { rollback = error.message === "outbox fixture failure"; }
    failBatch = false;
    ok(rollback && JSON.stringify(await readVaultPair(db)) === JSON.stringify(before)
      && !sqlite.prepare("SELECT id FROM vault_receipt WHERE id=?").get(broken.at),
      "an outbox insert failure rolls back the pair and receipt in the actual SQLite transaction");
    const outbox = sqlite.prepare("SELECT id FROM vault_outbox ORDER BY id LIMIT 1").get();
    const delivered = new Map();let crash = true;
    const send = async (entry) => {
      if (!delivered.has(entry.at)) delivered.set(entry.at, entry);
      if (crash) { crash = false;throw new Error("crash after queue"); }
      return { ok: true };
    };
    try { await consumeVaultOutbox(db, outbox.id, send); } catch (error) {
      if (error.message !== "crash after queue") throw error;
    }
    const pending = sqlite.prepare("SELECT state FROM vault_outbox WHERE id=?").get(outbox.id).state;
    await consumeVaultOutbox(db, outbox.id, send);
    const completedReplay = await consumeVaultOutbox(db, outbox.id, send);
    ok(pending === "pending" && delivered.size === 1 && completedReplay.replay
      && sqlite.prepare("SELECT state FROM vault_outbox WHERE id=?").get(outbox.id).state === "complete",
      "a vault outbox crash after queue resumes the fixed-id writer once and completed replay never resends");
    const malformed = await commitVaultPair(db, { ...broken, names: { name: "private" } }, "seed");
    const oversize = await commitVaultPair(db, { ...broken, names: seal("x".repeat(600000)) }, "seed");
    ok(malformed.status === 400 && [400, 413].includes(oversize.status),
      "versioned vault refuses plaintext-shaped or oversized envelope requests explicitly");
    const invalidSalt = await commitVaultPair(db, { ...broken, names: { ...broken.names, salt: "YQ==" } }, "seed");
    const invalidIV = await commitVaultPair(db, { ...broken, names: { ...broken.names, iv: "Yg==" } }, "seed");
    const invalidTag = await commitVaultPair(db, { ...broken, names: { ...broken.names, ct: "Yw==" } }, "seed");
    ok([invalidSalt, invalidIV, invalidTag].every((result) => result.status === 400),
      "vault pair ciphertext validates the salt, GCM nonce and minimum authentication tag lengths");
    const secondOutbox = sqlite.prepare("SELECT id FROM vault_outbox WHERE state='pending' LIMIT 1").get();
    let refusedSend = false;
    try { await consumeVaultOutbox(db, secondOutbox.id, async () => ({ ok: false })); }
    catch (error) { refusedSend = error.message.includes("did not confirm"); }
    ok(refusedSend && sqlite.prepare("SELECT state FROM vault_outbox WHERE id=?").get(secondOutbox.id).state === "pending",
      "a failed fixed-id outbox send stays pending rather than returning a completed receipt");
    const key = "vault-route-fixture-key-32-characters", capability = "vault-maker-fixture-key-32-characters";
    let legacyWrites = 0;
    const env = { SALT_LEDGER: db, SALT_WRITE_KEY: key, COUNTER_MAKER_KEY: capability, REQUIRE_ACCESS: "0", VAULT_STORE: "pair",
      SALT_QUEUE: { get: async () => null, put: async () => { legacyWrites++; } } };
    const ctx = { waitUntil() {} };
    const request = (path, method = "GET", body, headers = { "X-Salt-Key": key }) =>
      new Request("https://desk.test" + path, { method, headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const missing = await worker.fetch(request("/vault/pair", "GET", undefined, {}), env, ctx);
    const unconfigured = await worker.fetch(request("/vault/pair"), { ...env, SALT_WRITE_KEY: "" }, ctx);
    const unavailable = await worker.fetch(request("/vault/pair"), { ...env, VAULT_STORE: undefined }, ctx);
    const gate = await worker.fetch(request("/vault/pair"), { ...env, REQUIRE_ACCESS: "1" }, ctx);
    ok(!missing.ok && unconfigured.status === 503 && unavailable.status === 503 && !gate.ok,
      "actual vault pair routes require the write key and human Access when enabled, and never enable authority implicitly");
    const currentPair = await readVaultPair(db);
    const routeBody = pair("2026-10-01T04:00:00.000Z", currentPair.revision, "route");
    const saved = await worker.fetch(request("/vault/pair", "POST", routeBody), env, ctx);
    const routeReplay = await worker.fetch(request("/vault/pair", "POST", routeBody), env, ctx);
    const stale = await worker.fetch(request("/vault/pair", "POST", { ...routeBody, at: "2026-10-01T04:01:00.000Z" }), env, ctx);
    const pairResponse = await worker.fetch(request("/vault/pair"), env, ctx);
    const namesResponse = await worker.fetch(request("/vault", "GET", undefined, {}), env, ctx);
    const names = await namesResponse.json(), snapshot = await pairResponse.json();
    ok(saved.status === 200 && (await routeReplay.json()).replay && stale.status === 409
      && snapshot.revision === currentPair.revision + 1 && names.revision === snapshot.revision
      && JSON.stringify(snapshot.names) === JSON.stringify(routeBody.names)
      && JSON.stringify(snapshot.places) === JSON.stringify(routeBody.places)
      && !Object.hasOwn(names, "places") && pairResponse.headers.get("cache-control") === "no-store",
      "actual Worker pair writes replay once, reject stale revisions and serve consistent keyed pairs with public names-only ciphertext");
    const oldNames = await worker.fetch(request("/vault", "POST", { vault: routeBody.names }), env, ctx);
    const oldPlaces = await worker.fetch(request("/vault/addr", "POST", { vault: routeBody.places }), env, ctx);
    const oldMaker = await worker.fetch(request("/_internal/maker/inputs/add-id", "POST", {},
      { "X-Counter-Maker-Key": capability }), env, ctx);
    ok(oldNames.status === 409 && oldPlaces.status === 409 && oldMaker.status === 409 && legacyWrites === 0
      && (await readVaultPair(db)).revision === snapshot.revision,
      "versioned Worker authority explicitly refuses unversioned Desk and Maker ID/place writers without touching the pair");
    const counterEnv = { COUNTER_MAKER_KEY: capability, DESK_MAKER: { fetch: (req) => worker.fetch(req, env, ctx) } };
    const owner = { email: "maakmal97@icloud.com" };
    const ownerPair = await handleMaker(new Request("https://counter.test/all/maker/vault/pair"),
      counterEnv, "/all/maker/vault/pair", owner);
    const other = await handleMaker(new Request("https://counter.test/all/maker/vault/pair"),
      counterEnv, "/all/maker/vault/pair", { email: "someone@example.test" });
    const wrongCapability = await worker.fetch(request("/_internal/maker/vault/pair", "GET", undefined, {}),
      env, ctx);
    ok(ownerPair.ok && (await ownerPair.json()).revision === snapshot.revision
      && other.status === 403 && wrongCapability.status === 404,
      "Counter owner pair read uses only the exact capability route and refuses other verified identities or missing capability");
    const planPair = { names: routeBody.names, places: routeBody.places };
    const plan = bootstrapPlan(planPair, structuredClone(planPair), "2026-10-01T00:00:00.000Z");
    let mismatch = false;
    try { bootstrapPlan(planPair, { ...planPair, places: seal("different") }, routeBody.at); }
    catch { mismatch = true; }
    const bootstrapDb = new DatabaseSync(":memory:");
    try {
      bootstrapDb.exec(readFileSync(new URL("../migrations/0015_vault_pair.sql", import.meta.url), "utf8"));
      bootstrapDb.exec(readFileSync(new URL("../migrations/0016_vault_write_gate.sql", import.meta.url), "utf8"));
      bootstrapDb.exec(plan.sql);
      const prematureBootstrap = bootstrapDb.prepare("SELECT revision FROM vault_pair").get();
      ok(!prematureBootstrap,
        "actual bootstrap SQL cannot install authority while the durable write gate is open");
      if (prematureBootstrap) bootstrapDb.exec("DELETE FROM vault_pair;");
      bootstrapDb.exec("UPDATE vault_write_gate SET phase='paused';");
      bootstrapDb.exec("INSERT INTO vault_write_active(id,started) VALUES('fixture-active','2026-09-30T00:00:00.000Z');");
      bootstrapDb.exec(plan.sql);
      const activeBootstrap = bootstrapDb.prepare("SELECT revision FROM vault_pair").get();
      ok(!activeBootstrap, "actual bootstrap SQL refuses a paused gate with an active writer");
      if (activeBootstrap) bootstrapDb.exec("DELETE FROM vault_pair;");
      bootstrapDb.exec("DELETE FROM vault_write_active;");
      bootstrapDb.exec("INSERT INTO vault_receipt(id,fingerprint,revision,created_at,operation) VALUES('2026-09-30T00:00:00.000Z','fixture',1,'2026-09-30T00:00:00.000Z','place');");
      bootstrapDb.exec("INSERT INTO vault_outbox(id,entry) VALUES('2026-09-30T00:00:00.000Z','{}');");
      bootstrapDb.exec(plan.sql);
      const pendingBootstrap = bootstrapDb.prepare("SELECT revision FROM vault_pair").get();
      ok(!pendingBootstrap, "actual bootstrap SQL refuses a paused gate with pending accepted work");
      if (pendingBootstrap) bootstrapDb.exec("DELETE FROM vault_pair;");
      bootstrapDb.exec("DELETE FROM vault_outbox; DELETE FROM vault_receipt;");
      bootstrapDb.exec(plan.sql);
      let secondBootstrap = false;
      try { bootstrapDb.exec(plan.sql); } catch { secondBootstrap = true; }
      ok(mismatch && secondBootstrap && bootstrapDb.prepare("SELECT revision,names,places FROM vault_pair").get().revision === 1,
        "maintenance bootstrap compares both legacy ciphertext reads and actual SQL refuses overwriting an initialized authority");
    } finally { bootstrapDb.close(); }
    const exported = await rollbackExport(db);
    ok(exported.pair.revision === snapshot.revision && exported.digest.length === 64
      && JSON.stringify(exported.pair.places) === JSON.stringify(routeBody.places),
      "rollback export reads a single consistent authority pair with revision and a verification digest");
    let pendingPrune = false;
    try { await pruneReceipts(db, "2026-10-02T00:00:00.000Z", "2026-11-03T00:00:00.000Z", true); }
    catch (error) { pendingPrune = error.message.includes("Pending"); }
    await consumeVaultOutbox(db, secondOutbox.id, async () => ({ ok: true }));
    const dryPrune = await pruneReceipts(db, "2026-10-02T00:00:00.000Z", "2026-11-03T00:00:00.000Z");
    const retainedBefore = sqlite.prepare("SELECT COUNT(*) AS n FROM vault_receipt").get().n;
    const appliedPrune = await pruneReceipts(db, "2026-10-02T00:00:00.000Z", "2026-11-03T00:00:00.000Z", true);
    const prunedReplay = await commitVaultPair(db, { ...routeBody, expectedRevision: snapshot.revision }, "seed");
    ok(pendingPrune && dryPrune.apply === false && retainedBefore > 0 && appliedPrune.apply
      && sqlite.prepare("SELECT COUNT(*) AS n FROM vault_receipt").get().n === 0
      && sqlite.prepare("SELECT COUNT(*) AS n FROM vault_outbox").get().n === 0
      && prunedReplay.status === 409 && /predates retained receipts/.test(prunedReplay.error)
      && (await readVaultPair(db)).revision === snapshot.revision,
      "receipt pruning refuses pending recovery, dry-runs first and retires old request ids without reopening their writes");
    let recentPrune = false;
    try { await pruneReceipts(db, "2026-10-02T00:00:00.000Z", "2026-10-03T00:00:00.000Z", true); }
    catch (error) { recentPrune = error.message.includes("thirty days"); }
    ok(recentPrune, "vault maintenance retains thirty days of replay receipts instead of accepting a recent cutoff");
    const insertReceipt = sqlite.prepare("INSERT INTO vault_receipt(id,fingerprint,revision,created_at,operation) VALUES (?, 'fixture', 1, ?, 'seed')");
    for (let i = 0; i < 1000; i++) insertReceipt.run("capacity-" + i, "2026-10-03T00:00:00.000Z");
    const full = await commitVaultPair(db, pair("2026-10-03T00:01:00.000Z", snapshot.revision, "full"), "seed");
    ok(full.status === 503 && (await readVaultPair(db)).revision === snapshot.revision
      && sqlite.prepare("SELECT COUNT(*) AS n FROM vault_receipt").get().n === 1000,
      "a full vault receipt store explicitly refuses new writes without changing authority or dropping replay records");
  } finally { sqlite.close(); }
}
