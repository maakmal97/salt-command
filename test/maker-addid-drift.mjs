import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { JSDOM } from "jsdom";
import worker from "../src/worker.js";
import { makerInputCatalog } from "../src/maker-inputs.js";
import { handleMaker } from "../stmt/maker.js";
import { landingPage } from "../stmt/page.js";
import { contentKey, wrapKey } from "../tools/stmt-crypto.mjs";
import { tile } from "./maker-act.mjs";

export async function run({ ok }) {
  const check = ok || ((condition, message) => { if (!condition) throw new Error(message); });
  const pass = "invented-addid-drift-pass", key = "counter-addid-drift-fixture-key-00001";
  const pricing = {
    tierNames: [],
    byProduct: {
      salt: { stockCost: 40, inputs: { policy: { tierRule: {
        drift: true, band: {}, presets: { "-50%": -0.5, "-30%": -0.3, "-20%": -0.2, "-10%": -0.1, "Median Price": 0, "+10%": 0.1, "+20%": 0.2, "+30%": 0.3, "+50%": 0.5, "+120%": 1.2, "-120%": -1.2 }
      } } } }
    }
  };
  const mirror = { version: 1, sales: [], purchases: [], pricing,
    state: { PRODUCTS: { salt: { name: "salt" } }, roster: ["CX1-FIK"], associates: ["CX1-FIK"],
      PROD_OPENING: { salt: { qty: 0, costPerKg: null } }, PEOPLE: { departed: [] } } };
  const catalog = makerInputCatalog(mirror);
  check(JSON.stringify(catalog.products.find((item) => item.product === "salt").driftPresets)
    === JSON.stringify([{ name: "-50%", value: -0.5 }, { name: "-30%", value: -0.3 }, { name: "-20%", value: -0.2 }, { name: "-10%", value: -0.1 }, { name: "Median Price", value: 0 }, { name: "+10%", value: 0.1 },
      { name: "+20%", value: 0.2 }, { name: "+30%", value: 0.3 }, { name: "+50%", value: 0.5 }])
    && catalog.products.find((item) => item.product === "salt").driftMin === -100 && catalog.products.find((item) => item.product === "salt").driftMax === 100
    && catalog.products.find((item) => item.product === "salt").driftUnit === "band",
  "Add ID catalog takes the % presets, -50% to +50%, from the active book rule, drops a preset outside its -100% to +100% range (+120%, -120%), and carries the range and the band unit");

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
    /* 18 Nov 2026 (his word: a smooth slider in steps of 5, never the long list): Set a starting % is a switch, off for Not set, and the % Ambient's slider, a range in
       whole % from the book's low to its high; a hand on it fires input and change */
    const onSwitch = section.querySelector('input.amb-switch[data-act="record.add-id.drift-on"][data-key="salt"]');
    const range = section.querySelector('input.amb-slider__input[data-act="record.add-id.drift"]');
    const said = () => range && range.closest(".amb-slider").querySelector(".amb-slider__value").textContent;
    const fire = (el, type) => el.dispatchEvent(new dom.window.Event(type, { bubbles: true }));
    const pick = (value) => {   /* '' is Not set; any other a fraction, put on the slider as its whole % */
      onSwitch.checked = value !== ""; fire(onSwitch, "change");
      if (value !== "") { range.value = String(Math.round(Number(value) * 100)); fire(range, "input"); fire(range, "change"); }
    };
    /* the form's own answer line is the last status in it; the first is the one unlock's (Phase 4b) */
    const status = [...section.querySelectorAll('[role="status"]')].at(-1);
    doc.querySelector('[data-act="vault.unlock"]').click();
    doc.getElementById("vaultPass").value = pass;
    doc.getElementById("vaultGo").click();
    check(await waitFor(() => /open on this phone/.test(section.textContent)) && doc.getElementById("vaultPass").value === "",
      "the one unlock opens the page for Add ID, which has no password field of its own");
    check(!!onSwitch && !!range && onSwitch.checked && range.value === "30" && said() === "+30%" && range.type === "range" && range.step === "5"
      && range.min === "-100" && range.max === "100" && !section.querySelector('[data-act="record.add-id.drift-value"]')
      && ![...section.querySelectorAll("fieldset.maker-tiles legend")].some((legend) => legend.textContent.startsWith("Starting %")),
    "generated Add ID starts salt at +30% (his word of 11 Nov 2026) on a slider in steps of 5 from the book's -100% to +100%, with no list and no typed %: "
      + JSON.stringify([onSwitch && onSwitch.checked, range && [range.min, range.max, range.step, range.value], said()]));
    if (!onSwitch || !range) throw new Error("Add ID did not render the starting drift controls.");
    pick("0");
    check(said() === "Median Price" && range.getAttribute("aria-valuetext") === "Median Price", "the slider says a preset's name where it rests on one (the Median Price at 0): " + said());
    pick("");
    check(said() === "Not set" && range.disabled, "Not set is the switch off: the slider stands disabled and says Not set: " + said());
    tile(section, "Role", "supplier");
    check(onSwitch.disabled && range.disabled, "Add ID disables starting drift for a supplier");
    tile(section, "Role", "customer");

    const submit = [...section.querySelectorAll("button")].find((button) => button.textContent === "Add the customer");
    const fields = section.querySelectorAll("input:not([type=radio])");
    const outcomes = [
      { name: "Ada", choice: "", expected: null },
      { name: "Bert", choice: "0.5", expected: { salt: 0.5 } },
      { name: "Cora", choice: "0", expected: { salt: 0 } },
      { name: "Dara", choice: "0.3", expected: { salt: 0.3 } },
      { name: "Hana", choice: "-0.3", expected: { salt: -0.3 } },
      { name: "Ivor", choice: "-0.5", expected: { salt: -0.5 } },
      { name: "Eli", choice: "0.15", expected: { salt: 0.15 } },
      { name: "Faye", choice: "-1", expected: { salt: -1 } },
      { name: "Gail", choice: "1", expected: { salt: 1 } }
    ];
    for (const outcome of outcomes) {
      fields[0].value = outcome.name; fields[1].value = "";
      pick(outcome.choice);
      const before = bridged.length;
      submit.click();
      const sent = await waitFor(() => bridged.length === before + 1 && /waits under Approve/.test(status.textContent));
      const call = bridged.at(-1), body = call?.body || {};
      const entry = call && (await sqlite.prepare("SELECT entry,row FROM draft WHERE id=?").get(body.at));
      const draft = entry && JSON.parse(entry.entry);
      const want = outcome.expected;
      /* 19 Oct 2026: a starting % leaves the form, the route and the draft with unit band (salt, -100% to +100%); a registration with none carries no unit */
      const tiersMatch = want === null ? body.tiers === null && body.unit === undefined && draft?.payload.unit === undefined
        : JSON.stringify(body.tiers) === JSON.stringify(want) && body.unit === "band" && draft?.payload.unit === "band";
      const draftMatches = want === null ? draft?.payload.tiers === null
        : JSON.stringify(draft?.payload.tiers) === JSON.stringify(want);
      const names = body.pair?.names ? await decrypt(body.pair.names) : {};
      check(sent && call?.path === "/_internal/maker/inputs/add-id" && tiersMatch
        && body.pair?.expectedRevision === before + 1 && draftMatches && entry && names
        && Object.values(names).some((value) => value.includes(outcome.name)),
      "Add ID " + (outcome.choice || "automatic") + " choice traverses the encrypted pair, authenticated route and real draft");
      if (outcome.name === "Faye" || outcome.name === "Gail")
        check(JSON.stringify(body.tiers) === JSON.stringify(want), "the slider reaches the book's own ends, -100% and +100%: " + JSON.stringify(body.tiers));
    }

    fields[0].value = "Gopal"; fields[1].value = "";
    pick("1.05");
    check(range.value === "100", "the slider holds at the book's high end, so nothing past it can be sent: " + range.value);
  } finally {
    dom.window.close();
  }
}
