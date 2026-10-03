import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { sqliteAdapter } from "../tools/vault-maintenance.mjs";
import { withVaultWrite, changeVaultWritePhase, vaultWriteStatus } from "../src/vault-write-gate.js";
import worker, { recoverVaultInputs } from "../src/worker.js";
import { seedLegacyEnvelope } from "../tools/seed-vault.mjs";
import { buildSeed } from "../tools/d1.mjs";

export function createGateFixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../migrations/0016_vault_write_gate.sql", import.meta.url), "utf8"));
  return { db: sqliteAdapter(sqlite), close: () => sqlite.close() };
}

export async function run({ ok }) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../migrations/0016_vault_write_gate.sql", import.meta.url), "utf8"));
  sqlite.exec(readFileSync(new URL("../migrations/0015_vault_pair.sql", import.meta.url), "utf8"));
  const db = sqliteAdapter(sqlite), env = { SALT_LEDGER: db };
  try {
    let entered, finish;
    const ready = new Promise(resolve => { entered = resolve; });
    const held = new Promise(resolve => { finish = resolve; });
    const writing = withVaultWrite(env, async () => { entered(); await held; return { ok: true }; });
    await ready;
    await changeVaultWritePhase(db, "draining", "2026-10-03T02:00:00.000Z");
    let premature = false;
    try { await changeVaultWritePhase(db, "paused", "2026-10-03T02:00:01.000Z"); }
    catch (error) { premature = /accepted writers finish/.test(error.message); }
    let ran = false;
    const blocked = await withVaultWrite(env, async () => { ran = true; return { ok: true }; });
    ok(premature && !ran && blocked.status === 503 && (await vaultWriteStatus(db)).active === 1,
      "durable draining gate rejects new writers and cannot pause while an accepted vault writer is active");
    finish(); await writing;
    sqlite.exec(`INSERT INTO vault_receipt(id,fingerprint,revision,created_at,operation)
      VALUES ('2026-10-03T01:00:00.000Z','invented',1,'2026-10-03T01:00:00.000Z','place');
      INSERT INTO vault_outbox(id,entry) VALUES ('2026-10-03T01:00:00.000Z','{}');`);
    let pendingRefused = false;
    try { await changeVaultWritePhase(db, "paused", "2026-10-03T02:00:01.500Z"); }
    catch { pendingRefused = true; }
    const consumed = await withVaultWrite(env, async () => {
      sqlite.exec("UPDATE vault_outbox SET state='complete' WHERE id='2026-10-03T01:00:00.000Z';");
      return { ok: true };
    }, true);
    ok(pendingRefused && consumed.ok && (await vaultWriteStatus(db)).phase === "draining",
      "draining allows only accepted outbox consumption and refuses pause until pending work reaches completion");
    let paused;
    try { paused = await changeVaultWritePhase(db, "paused", "2026-10-03T02:00:02.000Z"); }
    catch {
      ok(false, "completed writers release their claims so reviewed maintenance can reach paused");
      return;
    }
    const reloaded = sqliteAdapter(sqlite);
    ok(paused.phase === "paused" && paused.active === 0 && (await vaultWriteStatus(reloaded)).phase === "paused",
      "paused vault gate survives a new reader and confirms no in-flight mutation before ciphertext snapshots");
    const key = "invented-maintenance-key-32-characters";
    const routeEnv = { ...env, SALT_WRITE_KEY: key, COUNTER_MAKER_KEY: key, REQUIRE_ACCESS: "0", VAULT_STORE: "pair",
      SALT_QUEUE: { async get() { return null; }, async put() { throw new Error("paused vault wrote KV"); } } };
    const post = async (path, body = {}, internal = false) => {
      try { return await worker.fetch(new Request("https://desk.test" + path, {
      method: "POST", headers: { "content-type": "application/json", [internal ? "X-Counter-Maker-Key" : "X-Salt-Key"]: key },
      body: JSON.stringify(body)
      }), routeEnv, { waitUntil() {} }); }
      catch (error) { return new Response(JSON.stringify({ ok: false, error: "fixture unexpected exception: " + error.message }), { status: 500 }); }
    };
    for (const path of ["/vault", "/vault/addr", "/vault/pair"]) {
      const response = await post(path);
      ok(response.status === 503 && /Keep this input/.test((await response.json()).error),
        "paused maintenance refuses the actual " + path + " writer without discarding its client draft");
    }
    delete routeEnv.VAULT_STORE;
    const legacyNames = await post("/vault"), legacyPlaces = await post("/vault/addr");
    ok(legacyNames.status === 503 && legacyPlaces.status === 503
      && /maintenance/.test((await legacyNames.json()).error) && /maintenance/.test((await legacyPlaces.json()).error),
      "the maintenance gate also excludes live-default KV names and places writers before authority cutover");
    routeEnv.VAULT_STORE = "pair";
    for (const operation of ["add-id", "amend-id", "place"]) {
      const direct = await post("/vault/inputs/" + operation);
      const maker = await post("/_internal/maker/inputs/" + operation, {}, true);
      ok(direct.status === 503 && maker.status === 503 && /maintenance/.test((await direct.json()).error)
        && /maintenance/.test((await maker.json()).error),
        "paused maintenance blocks versioned and capability-gated Maker " + operation + " producers");
    }
    for (const mode of ["addid", "rename", "place"]) {
      const response = await post("/queue", { device: "invented", queue: [{ at: "2026-10-03T02:00:00.000Z", payload: { mode } }] });
      ok(response.status === 503 && /maintenance/.test((await response.json()).error),
        "paused maintenance blocks legacy queue " + mode + " ingress before drafting");
    }
    let directRecovery = false;
    try { await recoverVaultInputs(routeEnv, "2026-10-03T02:00:00.000Z"); }
    catch (error) { directRecovery = /maintenance/.test(error.message); }
    ok(directRecovery && await recoverVaultInputs(routeEnv) === 0,
      "paused maintenance stops direct and cron outbox consumers before reading or delivering accepted work");
    const readStatus = await worker.fetch(new Request("https://desk.test/vault/maintenance", { headers: { "X-Salt-Key": key } }), routeEnv, {});
    const changeStatus = await post("/vault/maintenance", { phase: "open" });
    ok((await readStatus.json()).phase === "paused" && changeStatus.status === 405,
      "device capability reads back maintenance but cannot reopen or change its phase");
    delete routeEnv.VAULT_STORE;
    const envelope = { vault: { v: 1, salt: "AAAA", iv: "AAAA", ct: "AAAA" } };
    const toolClient = { base: "https://desk.test", writeKey: key,
      fetch: request => worker.fetch(request, routeEnv, { waitUntil() {} }) };
    for (const kind of ["names", "places"]) {
      let refused = false;
      try { await seedLegacyEnvelope(envelope, kind, toolClient); }
      catch (error) { refused = /maintenance/.test(error.message); }
      ok(refused, "actual laptop legacy " + kind + " writer obeys the server-maintenance gate, not a direct KV put");
    }
    for (const migration of ["0001_ledger", "0013_maker_requests", "0014_input_admission"])
      sqlite.exec(readFileSync(new URL("../migrations/" + migration + ".sql", import.meta.url), "utf8"));
    sqlite.exec(`INSERT INTO maker_request(id,operation,fingerprint,entry) VALUES ('invented','loan','fixed','{}');
      INSERT INTO input_admission(id,fingerprint,resource,amount,snapshot,entry) VALUES ('invented','fixed','loan:invented',1,'fixed','{}');
      INSERT INTO vault_pair(one,revision,names,updated) VALUES (1,1,'ciphertext','fixed');`);
    sqlite.exec(buildSeed({ v: "invented", stamped: "invented", ledger: {} }).sql);
    ok((await vaultWriteStatus(db)).phase === "paused"
      && sqlite.prepare("SELECT COUNT(*) AS n FROM maker_request").get().n === 1
      && sqlite.prepare("SELECT COUNT(*) AS n FROM input_admission").get().n === 1
      && sqlite.prepare("SELECT COUNT(*) AS n FROM vault_receipt").get().n === 1
      && sqlite.prepare("SELECT revision FROM vault_pair WHERE one=1").get().revision === 1,
      "actual book reseed preserves standalone maintenance, admission, receipt and vault authority records");
    await changeVaultWritePhase(db, "open", "2026-10-03T02:00:03.000Z");
    const stored = [];
    routeEnv.SALT_QUEUE.put = async (key, value) => { stored.push({ key, value: JSON.parse(value) }); };
    await seedLegacyEnvelope(envelope, "names", toolClient);
    await seedLegacyEnvelope(envelope, "places", toolClient);
    ok(stored.length === 2 && stored[0].key === "vault" && stored[1].key === "vault-addr"
      && stored.every(row => JSON.stringify(row.value.vault) === JSON.stringify(envelope.vault)),
      "open maintenance gate preserves ordinary laptop KV seed behavior through both authenticated Worker routes");
    let failed = false;
    try { await withVaultWrite(env, async () => { throw new Error("invented writer failure"); }); }
    catch (error) { failed = error.message === "invented writer failure"; }
    ok(failed && (await vaultWriteStatus(db)).active === 0,
      "direct writer failure remains explicit and releases only its own active claim");
  } finally { sqlite.close(); }
}
