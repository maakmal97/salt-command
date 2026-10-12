import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { JSDOM } from "jsdom";
import worker from "../src/worker.js";
import { makerInputCatalog } from "../src/maker-inputs.js";
import { handleMaker } from "../stmt/maker.js";
import { landingPage } from "../stmt/page.js";
import { contentKey, wrapKey } from "../tools/stmt-crypto.mjs";
import { tile, tileGroup } from "./maker-act.mjs";

export async function run({ ok }) {
  const check = ok || ((condition, message) => { if (!condition) throw new Error(message); });
  const pass = "invented-addid-drift-pass", key = "counter-addid-drift-fixture-key-00001";
  const pricing = {
    tierNames: [],
    byProduct: {
      salt: { stockCost: 40, inputs: { policy: { tierRule: {
        drift: { up: 0.3, down: 0.2 }, presets: { Better: -0.3, Standard: 0, Higher: 0.3 }
      } } } }
    }
  };
  const mirror = { version: 1, sales: [], purchases: [], pricing,
    state: { PRODUCTS: { salt: { name: "salt" } }, roster: ["CX1-FIK"], associates: ["CX1-FIK"],
      PROD_OPENING: { salt: { qty: 0, costPerKg: null } }, PEOPLE: { departed: [] } } };
  const catalog = makerInputCatalog(mirror);
  check(JSON.stringify(catalog.products.find((item) => item.product === "salt").driftPresets)
    === JSON.stringify([{ name: "Better", value: -0.3 }, { name: "Standard", value: 0 }, { name: "Higher", value: 0.3 }]),
  "Add ID catalog takes drift preset names and values from the active book rule");

  const sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync(new URL("../migrations/", import.meta.url))
    .filter((name) => /^[0-9]+_.*[.]sql$/.test(name)).sort())
    sqlite.exec(readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"));
  const bound = (statement, args) => ({
    run() { return { meta: { changes: Number(statement.run(...args).changes) } }; },
    first() { return statement.get(...args) || null; },
    all() { return { results: statement.all(...args) }; }
  });
  const d1 = {
    batch(list) {
      sqlite.exec("BEGIN IMMEDIATE");
      try { const result = list.map((statement) => statement.run()); sqlite.exec("COMMIT"); return result; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return Object.assign(bound(statement, []), { bind: (...args) => bound(statement, args) });
    }
  };
  const state = (name, value) => sqlite.prepare("INSERT OR REPLACE INTO state(key,doc) VALUES (?,?)")
    .run(name, JSON.stringify(value));
  state("PRODUCTS", mirror.state.PRODUCTS);
  state("PRICING", pricing);
  state("roster", mirror.state.roster);
  state("associates", mirror.state.associates);
  state("PEOPLE", mirror.state.PEOPLE);
  state("PROD_OPENING", mirror.state.PROD_OPENING);
  sqlite.exec("INSERT INTO snapshot(one,v,stamped) VALUES (1,'maker-addid-drift-fixture',NULL)");

  const seal = async (value) => {
    const salt = webcrypto.getRandomValues(new Uint8Array(16));
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const base = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
    const aes = await webcrypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
    const ciphertext = await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, aes,
      new TextEncoder().encode(JSON.stringify(value)));
    return { v: 1, salt: Buffer.from(salt).toString("base64"), iv: Buffer.from(iv).toString("base64"),
      ct: Buffer.from(ciphertext).toString("base64") };
  };
  let pair = { revision: 1, names: await seal({ "CX1-FIK": "Invented Associate (Pudu)" }),
    places: await seal({ _base: { addr: "Invented base", lat: 3.1, lng: 101.7 } }) };
  sqlite.prepare("INSERT INTO vault_pair(one,revision,names,places,updated) VALUES (1,1,?,?,?)")
    .run(JSON.stringify(pair.names), JSON.stringify(pair.places), "2026-10-08T01:00:00.000Z");
  const map = new Map();
  const kv = { get: async (name) => map.get(name) ?? null, put: async (name, value) => { map.set(name, value); },
    delete: async (name) => { map.delete(name); },
    list: async ({ prefix = "" } = {}) => ({ keys: [...map.keys()].filter((name) => name.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
  const deskEnv = { SALT_LEDGER: d1, SALT_QUEUE: kv, COUNTER_MAKER_KEY: key, REQUIRE_ACCESS: "0", VAULT_STORE: "pair" };
  const bridged = [], counterEnv = { STMT: kv, COUNTER_MAKER_KEY: key,
    DESK_MAKER: { fetch: async (request) => {
      const path = new URL(request.url).pathname;
      const body = request.method === "POST" ? await request.clone().json() : null;
      if (path === "/_internal/maker/inputs/add-id") bridged.push({ path, body });
      const response = await worker.fetch(request, deskEnv, { waitUntil() {} });
      if (path === "/_internal/maker/inputs/add-id" && response.ok && body?.pair) {
        pair = { revision: body.pair.expectedRevision + 1, names: body.pair.names, places: body.pair.places };
      }
      return response;
    } } };
  const identity = { email: "maakmal97@icloud.com" };
  const masterKey = await contentKey("4".repeat(64), "maker-addid-drift");
  const adminOpen = { ok: true, byMaster: true, session: "", wrapMaster: await wrapKey("fixture-master", masterKey) };
  const dom = new JSDOM(landingPage("", "maker-addid-drift-nonce", { master: "fixture-master", accounts: [] }), {
    url: "https://counter.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(window) {
      Object.defineProperty(window, "crypto", { value: webcrypto, configurable: true });
      window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder; window.scrollTo = () => {};
      window.fetch = async (path, init = {}) => {
        const pathname = String(path);
        if (pathname.startsWith("/all/maker/")) {
          const response = await handleMaker(new Request("https://counter.test" + pathname, init), counterEnv, pathname, identity);
          return response;
        }
        const data = pathname === "/open" ? adminOpen
          : pathname === "/all/sheet" ? { ok: true, accounts: [] }
            : pathname === "/all/maker/review" ? { ok: true, orders: [], drafts: [] }
              : pathname === "/all/maker/hours" ? { ok: true, config: null, status: { open: true, source: "default" } }
                : { ok: true, accounts: [], orders: [], drafts: [], refs: [], tiers: [] };
        return { ok: true, status: 200, json: async () => data };
      };
    }
  });
  const waitFor = async (predicate) => {
    for (let index = 0; index < 200 && !predicate(); index++)
      await new Promise((resolve) => setTimeout(resolve, 10));
    return predicate();
  };
  const decrypt = async (envelope) => {
    const base = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
    const aes = await webcrypto.subtle.deriveKey({ name: "PBKDF2", salt: Buffer.from(envelope.salt, "base64"),
      iterations: 150000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    return JSON.parse(new TextDecoder().decode(await webcrypto.subtle.decrypt({ name: "AES-GCM",
      iv: Buffer.from(envelope.iv, "base64") }, aes, Buffer.from(envelope.ct, "base64"))));
  };
  try {
    const doc = dom.window.document;
    doc.querySelector('button[data-act="nav.record"]').click();
    check(await waitFor(() => [...doc.querySelectorAll("#makerInputs .maker-input h3")]
      .some((heading) => heading.textContent === "New customer")), "the generated Counter page opens Add ID");
    const section = [...doc.querySelectorAll("#makerInputs .maker-input")]
      .find((item) => item.querySelector("h3")?.textContent === "New customer");
    const driftSelect = [...section.querySelectorAll("fieldset.maker-tiles")]
      .find((group) => group.querySelector("legend").textContent.startsWith("Starting price drift"));
    const driftLabel = driftSelect && driftSelect.querySelector("legend").textContent;
    const pick = (value) => tile(section, driftLabel, value);   /* the drift is a group of tiles, and a tap on one is the change */
    const typed = [...section.querySelectorAll("input[type=number]")]
      .find((input) => input.closest("label")?.querySelector(".lbl")?.textContent.startsWith("Drift,"));
    /* the form's own answer line is the last status in it; the first is the one unlock's (Phase 4b) */
    const status = [...section.querySelectorAll('[role="status"]')].at(-1);
    doc.querySelector('[data-act="vault.unlock"]').click();
    doc.getElementById("vaultPass").value = pass;
    doc.getElementById("vaultGo").click();
    check(await waitFor(() => /open on this phone/.test(section.textContent)) && doc.getElementById("vaultPass").value === "",
      "the one unlock opens the page for Add ID, which has no password field of its own");
    check(!!driftSelect && !!typed && driftSelect.value === "" && typed.closest("label").hidden
      && [...driftSelect.querySelectorAll("input")].map((option) => option.value).join() === ",-0.3,0,0.3,typed"
      && typed.min === "-1" && typed.max === "1" && typed.step === "0.05",
    "generated Add ID offers automatic by default, the three rule presets, and a bounded typed drift: "
      + [...section.querySelectorAll("fieldset.maker-tiles legend")].map((legend) => legend.textContent).join("|"));
    if (!driftSelect || !typed) throw new Error("Add ID did not render the starting drift controls.");
    pick("typed");
    check(!typed.closest("label").hidden, "the typed drift field appears only after choosing Typed");
    pick("");
    tile(section, "Role", "supplier");
    check(driftSelect.disabled && typed.disabled, "Add ID disables starting drift for a supplier");
    tile(section, "Role", "customer");

    const submit = [...section.querySelectorAll("button")].find((button) => button.textContent === "Add the customer");
    const fields = section.querySelectorAll("input:not([type=radio])");
    const outcomes = [
      { name: "Ada", choice: "", expected: null },
      { name: "Bert", choice: "-0.3", expected: { salt: -0.3 } },
      { name: "Cora", choice: "0", expected: { salt: 0 } },
      { name: "Dara", choice: "0.3", expected: { salt: 0.3 } },
      { name: "Eli", choice: "typed", value: "-1", expected: { salt: -1 } },
      { name: "Faye", choice: "typed", value: "1", expected: { salt: 1 } },
      { name: "Gail", choice: "typed", value: "0.125", expected: { salt: 0.125 } }
    ];
    for (const outcome of outcomes) {
      fields[0].value = outcome.name; fields[1].value = "";
      pick(outcome.choice);
      if (outcome.value !== undefined) typed.value = outcome.value;
      const before = bridged.length;
      submit.click();
      const sent = await waitFor(() => bridged.length === before + 1 && /waits under Approve/.test(status.textContent));
      const call = bridged.at(-1), body = call?.body || {};
      const entry = call && (await sqlite.prepare("SELECT entry,row FROM draft WHERE id=?").get(body.at));
      const draft = entry && JSON.parse(entry.entry);
      const want = outcome.expected;
      const tiersMatch = want === null ? body.tiers === null : JSON.stringify(body.tiers) === JSON.stringify(want);
      const draftMatches = want === null ? draft?.payload.tiers === null
        : JSON.stringify(draft?.payload.tiers) === JSON.stringify(want);
      const names = body.pair?.names ? await decrypt(body.pair.names) : {};
      check(sent && call?.path === "/_internal/maker/inputs/add-id" && tiersMatch
        && body.pair?.expectedRevision === before + 1 && draftMatches && entry && names
        && Object.values(names).some((value) => value.includes(outcome.name)),
      "Add ID " + (outcome.choice || "automatic") + " choice traverses the encrypted pair, authenticated route and real draft");
      if (outcome.name === "Gail")
        check(body.tiers?.salt === 0.125 && draft?.payload.tiers?.salt === 0.125,
          "typed Add ID drift preserves 0.125 precision like the incumbent Desk");
    }

    fields[0].value = "Gopal"; fields[1].value = "";
    pick("typed");
    typed.value = "3";
    const beforeInvalid = bridged.length, revisionBeforeInvalid = pair.revision;
    submit.click();
    await waitFor(() => !submit.disabled);
    check(bridged.length === beforeInvalid && pair.revision === revisionBeforeInvalid
      && status.textContent === "Enter a drift from -1 to +1.",
    "typed drift 3 is refused before encryption, pair mutation or the Add ID route");
  } finally {
    dom.window.close();
  }
}
