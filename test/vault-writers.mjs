import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import worker from "../src/worker.js";
import { sqliteAdapter } from "../tools/vault-maintenance.mjs";
import { pairClient, readVaultAuthority } from "../tools/vault-pair-client.mjs";
import { seedVaultPair, seedVaultPairFiles, vaultEncrypt, vaultDecrypt } from "../tools/seed-vault.mjs";
import { pullVaultPair, pullVaultPairFiles } from "../tools/pull-vault.mjs";
import { withVaultFiles } from "../tools/vault-local-files.mjs";
import E from "../engine/position.mjs";

export async function run({ ok }) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../migrations/0015_vault_pair.sql", import.meta.url), "utf8"));
  sqlite.exec(readFileSync(new URL("../migrations/0016_vault_write_gate.sql", import.meta.url), "utf8"));
  const pass = "invented-fixture-passphrase", key = "invented-vault-writer-key-32-characters";
  const names = { "CX1-ZED": "Invented A" }, places = { _base: { lat: 3.1, lng: 101.7, addr: "Invented B" } };
  const original = { revision: 1, names: await vaultEncrypt(pass, names), places: await vaultEncrypt(pass, places) };
  sqlite.prepare("INSERT INTO vault_pair(one,revision,names,places,updated) VALUES (1,1,?,?,?)")
    .run(JSON.stringify(original.names), JSON.stringify(original.places), "2026-10-01T00:00:00.000Z");
  const env = { SALT_LEDGER: sqliteAdapter(sqlite), VAULT_STORE: "pair", SALT_WRITE_KEY: key, REQUIRE_ACCESS: "0" };
  const transport = (req) => worker.fetch(req, env, { waitUntil() {} });
  const client = pairClient({ base: "https://desk.test", writeKey: key, fetch: transport });
  try {
    const authority = await readVaultAuthority("https://desk.test", transport);
    const persisted = [];
    const pulled = await pullVaultPair(pass, { client, bio: { bio: {} }, addr: { addr: {} },
      persist: async (value) => persisted.push(value) });
    ok(authority.pair && pulled.revision === 1 && persisted.length === 1
      && persisted[0].bio.bio["CX1-ZED"].raw === "Invented A"
      && persisted[0].addr.addr._base?.addr === "Invented B"
      && persisted[0].pair.revision === 1,
      "actual pull writer reads both envelopes through the Worker and persists one ciphertext revision baseline");
    const local=mkdtempSync(join(tmpdir(),"salt-worker-pull-"));
    try{
      let crash=false;
      try{await pullVaultPairFiles(pass,{client,dir:local,afterWrite:()=>{throw new Error("actual pull interrupted");}});}
      catch(error){crash=error.message==="actual pull interrupted";}
      await withVaultFiles(local,async()=>{
        const read=file=>existsSync(join(local,file))?JSON.parse(readFileSync(join(local,file),"utf8")):{};
        const bio=read("salt_bio.json"),addr=read("salt_addr.json"),baseline=read("salt_vault_pair.json");
        ok(crash&&bio.bio?.["CX1-ZED"]?.raw==="Invented A"&&addr.addr?._base?.addr==="Invented B"&&baseline.revision===1,
          "actual Worker pull file path recovers both local plaintext files and its ciphertext baseline before the seed reads them");
      });
    }finally{rmSync(local,{recursive:true,force:true});}
    const latest = await client.read();
    await client.write({ at: "2026-10-01T01:00:00.000Z", expectedRevision: latest.revision,
      names: await vaultEncrypt(pass, { ...names, "CX2-ZED": "Invented C" }), places: latest.places });
    const requests = [], finished = [];
    await seedVaultPair(pass, { client, baseline: original, map: { "CX1-ZED": "Invented D" }, kind: "names",
      at: "2026-10-01T02:00:00.000Z", saveRequest: async (request) => requests.push(request),
      finishRequest: async (pair) => finished.push(pair) });
    const saved = await client.read(), opened = await vaultDecrypt(pass, saved.names);
    ok(opened["CX1-ZED"] === "Invented D" && opened["CX2-ZED"] === "Invented C"
      && JSON.stringify(await vaultDecrypt(pass, saved.places)) === JSON.stringify(places)
      && requests.length === 1 && finished[0].revision === saved.revision
      && !JSON.stringify(requests).includes("Invented D"),
      "actual seed writer merges disjoint remote edits, preserves the paired places and retains ciphertext before the Worker CAS");
    let reviewed = false, conflict = false;
    try { await seedVaultPair(pass, { client, baseline: original, map: { "CX1-ZED": "Invented E" }, kind: "names",
      review: async (codes) => { reviewed = codes.join(",") === "CX1-ZED"; return false; },
      saveRequest: async () => { throw new Error("unreviewed write"); }, finishRequest: async () => {} }); }
    catch (error) { conflict = error.message.includes("Local edits are kept"); }
    ok(reviewed && conflict && (await client.read()).revision === saved.revision,
      "seed conflict UX retains the local intent and refuses an overlapping edit without explicit review");
    await seedVaultPair(pass, { client, baseline: original, map: { "CX1-ZED": "Invented E" }, kind: "names",
      at: "2026-10-01T03:00:00.000Z", review: async () => true,
      saveRequest: async () => {}, finishRequest: async () => {} });
    ok((await vaultDecrypt(pass, (await client.read()).names))["CX1-ZED"] === "Invented E",
      "an explicitly reviewed seed conflict applies only the intended code over the latest paired revision");
    const retryBase = await client.read();
    let retained, crash = true, completed;
    const crashClient = { ...client, async write(body) {
      const response = await client.write(body);
      if (crash) { crash = false; throw new Error("transport lost after Worker commit"); }
      return response;
    } };
    try { await seedVaultPair(pass, { client: crashClient, baseline: retryBase, map: { ...places, "CX1-ZED": { lat: 3.2, lng: 101.8 } },
      kind: "places", at: "2026-10-01T04:00:00.000Z", saveRequest: async (request) => { retained = request; },
      finishRequest: async (pair) => { completed = pair; } }); }
    catch (error) { if (error.message !== "transport lost after Worker commit") throw error; }
    const committedRevision = (await client.read()).revision;
    const replay = await seedVaultPair(pass, { client, pending: retained,
      finishRequest: async (pair) => { completed = pair; } });
    ok(replay.replay && completed.revision === committedRevision && (await client.read()).revision === committedRevision
      && retained.body.at === "2026-10-01T04:00:00.000Z",
      "seed recovery resends the retained ciphertext id after a lost response and never reseals or advances authority twice");
    const raceBase = await client.read();
    let ready, reads = 0;
    const barrier = new Promise((resolve) => { ready = resolve; });
    const raceClient = { ...client, async read() {
      const pair = await client.read(); reads++; if (reads === 2) ready(); await barrier; return pair;
    } };
    const raceMaps = await vaultDecrypt(pass, raceBase.names);
    const races = await Promise.allSettled(["CX3-ZED", "CX4-ZED"].map((code, index) =>
      seedVaultPair(pass, { client: raceClient, baseline: raceBase, map: { ...raceMaps, [code]: "Invented F" }, kind: "names",
        at: "2026-10-01T05:00:00.00" + index + "Z", saveRequest: async () => {}, finishRequest: async () => {} })));
    ok(races.filter((result) => result.status === "fulfilled").length === 1
      && races.some((result) => result.status === "rejected" && result.reason.status === 409)
      && (await client.read()).revision === raceBase.revision + 1,
      "concurrent actual seed writers admit one Worker CAS and retain the losing intent for reviewed rebase");
    const dryAt = (await client.read()).revision;
    const dryPull = await pullVaultPair(pass, { client, bio: {}, addr: {}, dry: true,
      persist: async () => { throw new Error("dry pull wrote"); } });
    const drySeed = await seedVaultPair(pass, { client, baseline: await client.read(), map: {}, kind: "places", dry: true,
      saveRequest: async () => { throw new Error("dry seed wrote"); }, finishRequest: async () => {} });
    ok(dryPull.dry && drySeed.dry && (await client.read()).revision === dryAt,
      "pair seed and pull dry runs exercise decryption and merge without persisting or submitting any writer");
    const seedDir = mkdtempSync(join(tmpdir(), "salt-seed-reconcile-"));
    try {
      const read = file => JSON.parse(readFileSync(join(seedDir, file), "utf8"));
      const write = (file, value) => writeFileSync(join(seedDir, file), JSON.stringify(value));
      const editName = value => { const bio = read("salt_bio.json"); bio.bio["CX1-ZED"].raw = value; write("salt_bio.json", bio); };
      const remote = async (namesEdit, placesEdit, at) => {
        const pair = await client.read();
        const n = await vaultDecrypt(pass, pair.names), p = await vaultDecrypt(pass, pair.places);
        await client.write({ at, expectedRevision: pair.revision,
          names: await vaultEncrypt(pass, namesEdit(n)), places: await vaultEncrypt(pass, placesEdit(p)) });
      };
      await pullVaultPairFiles(pass, { client, dir: seedDir });
      await remote(n => ({ ...n, "CX8-ZED": "Invented remote addition" }), p => p, "2026-10-01T06:00:00.000Z");
      editName("Invented local seed");
      await seedVaultPairFiles(pass, { client, dir: seedDir, at: "2026-10-01T06:01:00.000Z" });
      await seedVaultPairFiles(pass, { client, dir: seedDir, at: "2026-10-01T06:02:00.000Z" });
      ok((await vaultDecrypt(pass, (await client.read()).names))["CX8-ZED"] === "Invented remote addition"
        && read("salt_bio.json").bio["CX8-ZED"]?.raw === "Invented remote addition",
        "repeated ordinary file seeds reconcile a remote addition alongside baseline advancement instead of deleting it");
      await remote(n => ({ ...n, "CX8-ZED": "Invented remote amendment" }), p => p, "2026-10-01T06:03:00.000Z");
      editName("Invented second local seed");
      await seedVaultPairFiles(pass, { client, dir: seedDir, at: "2026-10-01T06:04:00.000Z" });
      await seedVaultPairFiles(pass, { client, dir: seedDir, at: "2026-10-01T06:05:00.000Z" });
      ok((await vaultDecrypt(pass, (await client.read()).names))["CX8-ZED"] === "Invented remote amendment"
        && read("salt_bio.json").bio["CX8-ZED"]?.raw === "Invented remote amendment",
        "repeated file seeds retain a remote amendment rather than reverting it from stale local plaintext");
      const addr = read("salt_addr.json");
      addr.addr["CX9-ZED"] = { lat: 4.1, lng: 102.1, addr: "Invented unsent place" };
      write("salt_addr.json", addr);
      await remote(n => n, p => ({ ...p, "CX8-ZED": { lat: 4.2, lng: 102.2, addr: "Invented remote place" } }),
        "2026-10-01T06:06:00.000Z");
      await seedVaultPairFiles(pass, { client, dir: seedDir, at: "2026-10-01T06:07:00.000Z" });
      const partnerBefore = await vaultDecrypt(pass, (await client.read()).places);
      await seedVaultPairFiles(pass, { client, dir: seedDir, kind: "places", at: "2026-10-01T06:08:00.000Z" });
      const partnerAfter = await vaultDecrypt(pass, (await client.read()).places);
      ok(!partnerBefore["CX9-ZED"] && partnerAfter["CX9-ZED"]?.lat === 4.1 && partnerAfter["CX8-ZED"]?.lat === 4.2
        && read("salt_addr.json").addr["CX8-ZED"]?.lat === 4.2,
        "names seed reconciles remote places while preserving unsent partner edits for the later addr seed");
      await remote(n => ({ ...n, "CY1-ZED": "Invented retry addition" }), p => p, "2026-10-01T06:09:00.000Z");
      editName("Invented interrupted seed");
      let interrupted = false;
      try { await seedVaultPairFiles(pass, { client, dir: seedDir, at: "2026-10-01T06:10:00.000Z",
        afterWrite: () => { throw new Error("seed completion interrupted"); } }); }
      catch (error) { if (error.message !== "seed completion interrupted") throw error; interrupted = true; }
      const committed = (await client.read()).revision;
      await seedVaultPairFiles(pass, { client, dir: seedDir, retry: true });
      const replayRevision = (await client.read()).revision;
      await seedVaultPairFiles(pass, { client, dir: seedDir, at: "2026-10-01T06:11:00.000Z" });
      ok(interrupted && committed === replayRevision && !existsSync(join(seedDir, "salt_vault_pair_request.json"))
        && read("salt_bio.json").bio["CY1-ZED"]?.raw === "Invented retry addition"
        && (await vaultDecrypt(pass, (await client.read()).names))["CY1-ZED"] === "Invented retry addition",
        "retained seed completion recovers its journal and reconciles plaintext with the replayed baseline before another seed");
    } finally { rmSync(seedDir, { recursive: true, force: true }); }
    const rekeyBase = { "CX1-ZED": "Invented A", "CX1-ZED-R": "Invented B" };
    const intended = { "CX2-ZED": "Invented A", "CX2-ZED-R": "Invented B" };
    const conflictMap = E.vaultMapMerge(rekeyBase, intended, { ...rekeyBase, "CX2-ZED": "Invented C" });
    ok(conflictMap.conflicts.includes("CX2-ZED") && conflictMap.map["CX2-ZED"] === "Invented C"
      && E.vaultMapMerge(places, places, { ...places, "CX7-ZED": { lat: 3, lng: 102 } }).map._base.addr === "Invented B",
      "shared device/laptop merge refuses a rekey destination collision and preserves untouched base and descendant data");
  } finally { sqlite.close(); }
}
