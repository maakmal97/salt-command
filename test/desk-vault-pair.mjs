import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import worker from "../src/worker.js";
import { openMaster } from "../tools/payload.mjs";
import { sqliteAdapter } from "../tools/vault-maintenance.mjs";
import { pairClient } from "../tools/vault-pair-client.mjs";
import { vaultEncrypt, vaultDecrypt } from "../tools/seed-vault.mjs";

export async function run({ ok }) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../migrations/0015_vault_pair.sql", import.meta.url), "utf8"));
  sqlite.exec(readFileSync(new URL("../migrations/0016_vault_write_gate.sql", import.meta.url), "utf8"));
  const pass = "invented-desk-vault-pass", key = "invented-desk-vault-key-32-characters";
  const originalNames = { "CX1-ZED": "Invented original" }, originalPlaces = { _base: { lat: 3.1, lng: 101.7 } };
  const seal = async (value) => vaultEncrypt(pass, value);
  sqlite.prepare("INSERT INTO vault_pair(one,revision,names,places,updated) VALUES (1,1,?,?,?)")
    .run(JSON.stringify(await seal(originalNames)), JSON.stringify(await seal(originalPlaces)), "2026-10-01T00:00:00.000Z");
  const env = { SALT_LEDGER: sqliteAdapter(sqlite), SALT_WRITE_KEY: key, VAULT_STORE: "pair", REQUIRE_ACCESS: "0" };
  const transport = (req) => worker.fetch(req, env, { waitUntil() {} });
  const client = pairClient({ base: "https://desk.test", writeKey: key, fetch: transport });
  let { w } = await openMaster();
  let stale = true, lost = false, confirms = [], posts = 0;
  try {
    Object.defineProperty(w, "crypto", { value: webcrypto, configurable: true });
    w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
    w.prompt = () => pass;
    w.confirm = () => confirms.shift() ?? false;
    w.localStorage.setItem("saltWriteKey", key);
    w.fetch = async (path, options = {}) => {
      if (String(path) === "vault/pair" && options.method === "POST") {
        posts++;
        if (stale) {
          stale = false;
          const pair = await client.read();
          await client.write({ at: "2026-10-01T00:01:00.000Z", expectedRevision: pair.revision,
            names: await seal({ "CX1-ZED": "Invented remote", "CX2-ZED": "Invented unrelated" }), places: pair.places });
        }
      }
      const response = await transport(new Request("https://desk.test/" + path, {
        ...options, headers: options.headers || {}, cache: "no-store"
      }));
      if (lost && options.method === "POST") { lost = false; throw new Error("lost after pair write"); }
      return response;
    };
    w.eval("qSyncState='server';vaultPairVersion=1;render=function(){};renderReveal=function(){};");
    const first = await w.eval("wbVaultFile(function(map){map['CX1-ZED']='Invented local';},function(map){map['CX1-ZED']={lat:3.2,lng:101.8};})");
    const pending = w.eval("JSON.stringify(wbVaultPending)");
    ok(typeof first === "string" && pending.includes("expectedRevision") && !pending.includes("Invented local")
      && !pending.includes("Invented original") && (await client.read()).revision === 2 && posts === 1,
      "actual Desk vault writer keeps ciphertext-only intent after stale CAS without claiming a saved pair");
    const persisted = w.localStorage.getItem("saltVaultPending"), fetchAgain = w.fetch;
    ok(persisted && !persisted.includes("Invented local") && !persisted.includes(pass),
      "Desk retains only ciphertext and fixed request metadata before transport, never a passphrase or opened maps");
    if(!persisted)return;
    w.close();({ w } = await openMaster());
    Object.defineProperty(w, "crypto", { value: webcrypto, configurable: true });
    w.TextEncoder = TextEncoder;w.TextDecoder = TextDecoder;w.fetch = fetchAgain;
    w.localStorage.setItem("saltWriteKey", key);w.localStorage.setItem("saltVaultPending", persisted);
    w.eval("qSyncState='server';render=function(){};renderReveal=function(){};");
    w.prompt = () => null;w.confirm = () => confirms.shift() ?? false;
    const lockedRetry = await w.eval("wbVaultFile(function(){},null)");
    ok(/passphrase/.test(lockedRetry) && posts === 1 && w.localStorage.getItem("saltVaultPending") === persisted,
      "a reloaded Desk requires unlock and keeps the identical ciphertext request without sending or clearing it");
    w.prompt = () => pass;
    const otherForm = await w.eval("wbVaultFile(function(){},null,{operation:'place',places:{'CX2-ZED':[3.1,101.7]}})");
    ok(/different encrypted vault input/.test(otherForm) && posts === 1
      && w.eval("JSON.stringify(wbVaultPending)") === pending,
      "Desk keeps a retained encrypted input bound to its original form instead of retrying it as another maker action");
    confirms = [false, true, false];
    const cancelled = await w.eval("wbVaultFile(function(){},null)");
    ok(/Conflict not applied/.test(cancelled) && posts === 1 && (await client.read()).revision === 2
      && w.eval("!!wbVaultPending"),
      "actual Desk conflict Cancel keeps its encrypted draft and makes no replacement write");
    confirms = [false, true, true];
    const applied = await w.eval("wbVaultFile(function(){},null)");
    const pair = await client.read(), names = await vaultDecrypt(pass, pair.names), places = await vaultDecrypt(pass, pair.places);
    ok(applied === null && names["CX1-ZED"] === "Invented local" && names["CX2-ZED"] === "Invented unrelated"
      && places["CX1-ZED"]?.lat === 3.2 && places._base?.lat === 3.1 && pair.revision === 3 && !w.eval("!!wbVaultPending")
      && !w.localStorage.getItem("saltVaultPending"),
      "actual Desk reviewed rebase atomically preserves unrelated names and base while applying the intended name/place pair");
    lost = true;
    w.eval("vaultNames={'CX1-ZED':'Invented local'};vaultPlaces={};");
    const interrupted = await w.eval("wbVaultFile(function(map){map['CX3-ZED']='Invented retry';},null)");
    const retryBody = w.eval("JSON.stringify(wbVaultPending.body)");
    const revision = (await client.read()).revision;
    confirms = [true];
    const retried = await w.eval("wbVaultFile(function(){},null)");
    ok(typeof interrupted === "string" && retried === null && (await client.read()).revision === revision
      && JSON.parse(retryBody).expectedRevision === revision - 1 && !w.eval("!!wbVaultPending")
      && w.eval("vaultNames['CX3-ZED']==='Invented retry'&&vaultPlaces['CX1-ZED']?.lat===3.2"),
      "actual Desk transport recovery resends the encrypted request unchanged after commit and replays one revision");
    const originalFetch = w.fetch;
    let started, release;
    const hasStarted = new Promise((resolve) => { started = resolve; });
    const canFinish = new Promise((resolve) => { release = resolve; });
    w.fetch = async (path, options) => {
      if (path === "vault") { started();await canFinish; }
      return originalFetch(path, options);
    };
    const inFlight = w.eval("wbVaultFile(function(map){map['CX4-ZED']='Invented single submit';},null)");
    await hasStarted;
    const duplicateRequest = w.eval("wbVaultFile(function(){},null)");
    release();
    const single = await inFlight;
    const duplicate = await duplicateRequest;
    w.fetch = originalFetch;
    ok(/already sending/.test(duplicate) && single === null && (await client.read()).revision === revision + 1,
      "Desk disables a second vault submit while encryption or transport of the first input is still in flight");
    w.eval("vaultPairVersion=1;NAME_VAULT=null;");
    // Load a prior names envelope: reveal must reread both envelopes from one pair, not mix compatibility reads.
    w.eval("NAME_VAULT=" + JSON.stringify(await seal(originalNames)) + ";");
    const revealed = await w.vaultReveal(pass);
    const opened = JSON.parse(w.eval("JSON.stringify({names:vaultNames,places:vaultPlaces})"));
    ok(revealed && opened.names["CX1-ZED"] === "Invented local" && opened.places["CX1-ZED"]?.lat === 3.2,
      "Desk unlock rereads one pair revision before opening names and places instead of mixing old names with new places");
    w.eval("wbVaultPending=null;");
    w.localStorage.setItem("saltVaultPending", persisted);
    confirms=[false,false,true];
    await w.eval("wbVaultFile(function(){},null)");
    ok(!w.localStorage.getItem("saltVaultPending") && !w.eval("!!wbVaultPending"),
      "Desk removes a reload-persistent request only after explicit local cancellation, without withdrawing a server input");
    const unsafe=JSON.parse(persisted);unsafe.body.passphrase=pass;
    w.localStorage.setItem("saltVaultPending",JSON.stringify(unsafe));
    const postsBeforeInvalid=posts;
    const invalid=await w.eval("wbVaultFile(function(){},null)");
    ok(/invalid/.test(invalid)&&posts===postsBeforeInvalid&&w.localStorage.getItem("saltVaultPending"),
      "Desk refuses a tampered persisted request carrying secret or opened metadata instead of submitting or silently deleting it");
    w.localStorage.removeItem("saltVaultPending");w.eval("wbVaultPending=null;");
    Object.defineProperty(w,"localStorage",{value:{getItem:name=>name==="saltWriteKey"?key:null,setItem:()=>{throw new Error("fixture storage full");},removeItem(){}},configurable:true});
    const noDurability=await w.eval("wbVaultFile(function(map){map['CX5-ZED']='Invented storage fail';},null)");
    ok(/storage full/.test(noDurability)&&posts===postsBeforeInvalid,
      "Desk refuses transport when ciphertext retry persistence fails, leaving no success-shaped second input");
  } finally { w.close(); sqlite.close(); }
}
