import { webcrypto } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { JSDOM } from "jsdom";
import { landingPage } from "../stmt/page.js";
import { handleMaker } from "../stmt/maker.js";
import worker from "../src/worker.js";

export async function run({ ok, pageWork }) {
  const pass = "invented-vault-pass", key = "blank-locality-fixture-capability";
  const sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync(new URL("../migrations/", import.meta.url)).filter((f) => /^[0-9]+_.*[.]sql$/.test(f)).sort())
    sqlite.exec(readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"));
  const bound = (st, args) => ({
    run() { return { meta: { changes: Number(st.run(...args).changes) } }; },
    first() { return st.get(...args) || null; }, all() { return { results: st.all(...args) }; }
  });
  const d1 = {
    batch(list) {
      sqlite.exec("BEGIN IMMEDIATE");
      try { const result = list.map((s) => s.run()); sqlite.exec("COMMIT"); return result; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
    prepare(sql) { const st = sqlite.prepare(sql); return Object.assign(bound(st, []), { bind: (...a) => bound(st, a) }); }
  };
  const state = (k, v) => sqlite.prepare("INSERT OR REPLACE INTO state(key,doc) VALUES (?,?)").run(k, JSON.stringify(v));
  state("PRODUCTS", { salt: { name: "salt" } });
  state("PRICING", { tierNames: [], byProduct: { salt: { stockCost: 40,
    inputs: { policy: { tierRule: { fixed: true } } } } } });
  state("roster", ["CX1-FIK"]); state("associates", ["CX1-FIK"]);
  sqlite.exec("INSERT INTO snapshot(one,v,stamped) VALUES (1,'blank-locality-fixture',NULL)");
  const crypt = async (value, decrypt = false) => {
    const salt = decrypt ? Buffer.from(value.salt, "base64") : webcrypto.getRandomValues(new Uint8Array(16));
    const iv = decrypt ? Buffer.from(value.iv, "base64") : webcrypto.getRandomValues(new Uint8Array(12));
    const base = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
    const aes = await webcrypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, [decrypt ? "decrypt" : "encrypt"]);
    if (decrypt) return JSON.parse(new TextDecoder().decode(await webcrypto.subtle.decrypt(
      { name: "AES-GCM", iv }, aes, Buffer.from(value.ct, "base64"))));
    return { v: 1, salt: Buffer.from(salt).toString("base64"), iv: Buffer.from(iv).toString("base64"),
      ct: Buffer.from(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, aes,
        new TextEncoder().encode(JSON.stringify(value)))).toString("base64") };
  };
  const originalPlaces = { _base: { addr: "Invented base", lat: 3.1, lng: 101.7 },
    "CX1-FIK": { addr: "Invented lane", lat: 3.12, lng: 101.71 } };
  sqlite.prepare("INSERT INTO vault_pair(one,revision,names,places,updated) VALUES (1,1,?,?,?)")
    .run(JSON.stringify(await crypt({ "CX1-FIK": "Invented Person (Pudu)" })),
      JSON.stringify(await crypt(originalPlaces)), "2026-10-08T01:00:00.000Z");
  const map = new Map();
  const kv = {
    get: async (k, type) => { const v = map.get(k) ?? null; return type === "json" && v ? JSON.parse(v) : v; },
    put: async (k, v) => { map.set(k, v); }, delete: async (k) => { map.delete(k); },
    list: async ({ prefix = "" } = {}) => ({ keys: [...map.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true })
  };
  const deskEnv = { SALT_LEDGER: d1, SALT_QUEUE: kv, COUNTER_MAKER_KEY: key, REQUIRE_ACCESS: "0", VAULT_STORE: "pair" };
  const bridgeCalls = [], counterEnv = { STMT: kv, COUNTER_MAKER_KEY: key,
    DESK_MAKER: { fetch: async (request) => {
      bridgeCalls.push({ path: new URL(request.url).pathname,
        body: request.method === "POST" ? await request.clone().json() : null });
      return worker.fetch(request, deskEnv, { waitUntil() {} });
    } } };
  const route = "/all/maker/inputs/add-id";
  const call = (body) => handleMaker(new Request("https://counter.test" + route, {
    method: "POST", body: JSON.stringify(body)
  }), counterEnv, route, { email: "maakmal97@icloud.com" });
  const pair = () => sqlite.prepare("SELECT revision,names,places FROM vault_pair").get();
  const draft = (at) => {
    const row = sqlite.prepare("SELECT entry,row FROM draft WHERE id=?").get(at);
    return row ? { entry: JSON.parse(row.entry), row: JSON.parse(row.row) } : null;
  };
  const device = async ({ name = "Test Person", locality = "", link = "", kind = "customer" } = {}, retain = false) => {
    const calls = [];
    let work;
    const dom = new JSDOM(landingPage("", "blank-locality-nonce", { master: "fixture-master", accounts: [] }), {
      url: "https://counter.test/all", runScripts: "dangerously", pretendToBeVisual: true,
      beforeParse(win) {
        Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true });
        win.TextEncoder = TextEncoder; win.TextDecoder = TextDecoder; win.scrollTo = () => {};
        win.fetch = async (path, init = {}) => {
          const p = String(path);
          if (p === "/all/maker/inputs" || p.startsWith("/all/maker/inputs/") || p.startsWith("/all/maker/vault") || p === route) {
            if (p === route) calls.push(JSON.parse(init.body));
            return handleMaker(new Request("https://counter.test" + p, init), counterEnv, p,
              { email: "maakmal97@icloud.com" });
          }
          return new Response(JSON.stringify({ ok: true, accounts: [], orders: [], drafts: [], claims: [],
            threads: [], pools: [], config: null, status: { open: true } }));
        };
        work = pageWork(win);
      }
    });
    try {
      dom.window.document.querySelector('button[data-m="maker"]').click();
      if (!await work.quiet()) throw new Error("Maker inputs did not settle.");
      const section = [...dom.window.document.querySelectorAll("#makerInputs .maker-input")]
        .find((s) => s.querySelector("h3").textContent === "Add ID");
      if (!section) throw new Error("Add ID was not drawn.");
      const fields = section.querySelectorAll("input");
      const role = section.querySelector("select");
      role.value = kind; role.dispatchEvent(new dom.window.Event("change"));
      fields[0].value = name; fields[1].value = locality; fields[2].value = pass; fields[3].value = link;
      section.querySelector("button").click();
      if (!await work.quiet()) throw new Error("Add ID did not settle.");
      return { body: calls[0], status: section.querySelector('[role="status"]').textContent,
        password: fields[2].value, ...(retain ? { dom, work, close: () => dom.window.close() } : {}) };
    } finally { if (!retain) dom.window.close(); }
  };
  try {
    const blank = await device({}, true);
    const filed = pair(), names = await crypt(JSON.parse(filed.names), true), places = await crypt(JSON.parse(filed.places), true);
    ok(blank.body?.code === "CT11-TBC" && names["CT11-TBC"] === "Test Person (to be confirmed)"
      && blank.password === "" && /queued for review/.test(blank.status),
      "blank-locality device/pair: the actual owner script derives CT11-TBC and encrypts the incumbent to-be-confirmed name: "
        + JSON.stringify({ code: blank.body?.code, name: names["CT11-TBC"], cleared: blank.password === "", status: blank.status }));
    ok(blank.body && !Object.hasOwn(blank.body, "geo") && !Object.hasOwn(blank.body, "locality")
      && !Object.hasOwn(blank.body, "addrVault") && !JSON.stringify(blank.body).includes("Test Person")
      && JSON.stringify(places) === JSON.stringify(originalPlaces),
      "blank-locality device/pair: absent locality and point are omitted, no place is invented and plaintext never travels");
    const booked = blank.body && draft(blank.body.at);
    ok(filed.revision === 2 && booked?.entry.payload.geo === null && booked.row.code === "CT11-TBC"
      && sqlite.prepare("SELECT state FROM vault_outbox WHERE id=?").get(blank.body?.at || "")?.state === "complete"
      && bridgeCalls.some((c) => c.path === "/_internal/maker/inputs/add-id" && c.body?.code === "CT11-TBC"),
      "blank-locality bridge: the actual Counter/Desk routes file the pair and finish one Add ID outbox with no geography");
    const tradeSection = [...blank.dom.window.document.querySelectorAll("#makerInputs .maker-input")]
      .find((section) => section.querySelector("h3")?.textContent === "Sale or purchase");
    const field = (label) => [...tradeSection.querySelectorAll("label")]
      .find((item) => item.firstChild.textContent === label)?.querySelector("input,select");
    const party = field("Party"), tradeDate = field("Date");
    const selectability = !!party && [...party.options].some((option) => option.value === "CT11-TBC");
    if (selectability) {
      party.value = "CT11-TBC";
      tradeDate.value = new Date().toISOString().slice(0, 10);
      field("Units").value = "1"; field("Goods total (RM)").value = "130";
      field("Cash recorded (RM)").value = "0"; field("Units moved").value = "0";
      field("Delivery (RM)").value = "0";
      [...tradeSection.querySelectorAll("button")].find((button) => button.textContent === "Send trade for review").click();
      if (!await blank.work.quiet()) throw new Error("The confirmed-ID trade did not settle.");
    }
    const trade = blank.body && sqlite.prepare("SELECT id,status,entry FROM draft WHERE collection='sales' AND id<>? ORDER BY drafted_at DESC LIMIT 1")
      .get(blank.body.at);
    ok(selectability && trade?.status === "pending" && JSON.parse(trade.entry).registrationDependencies?.[0]?.code === "CT11-TBC"
      && sqlite.prepare("SELECT state FROM vault_outbox WHERE id=?").get(blank.body?.at || "")?.state === "complete",
      "blank-locality Counter: confirmed Add ID refreshes the actual party selector and the selected trade reaches a pending native draft: "
        + JSON.stringify({ selectable: selectability, trade: trade?.status,
          dependency: trade && JSON.parse(trade.entry).registrationDependencies,
          answer: tradeSection?.querySelector('[role="status"]')?.textContent,
          drafts: sqlite.prepare("SELECT id,collection,status FROM draft ORDER BY drafted_at").all() }));
    blank.close();
    if (blank.body) {
      const replay = await call(blank.body), changed = await call({ ...blank.body, geo: [3.1, 101.7] });
      ok(replay.status === 200 && (await replay.json()).replay === true && changed.status === 409
        && pair().revision === 2 && sqlite.prepare("SELECT COUNT(*) n FROM draft WHERE id=?").get(blank.body.at).n === 1,
        "blank-locality bridge: identical retry is once-only and changed content under the same receipt refuses");
    } else ok(false, "blank-locality bridge: identical retry is once-only and changed content under the same receipt refuses");
    state("roster", ["CX1-FIK", "CT11-TBC"]);
    const clash = await device();
    ok(clash.body?.code === "CTE11-TBC", "blank-locality device/pair: a roster clash takes the next name letter, never another locality");
    const supplier = await device({ kind: "supplier", name: "Test Supplier" });
    const downstream = await device({ kind: "downstream", name: "Test Buyer" });
    const bucket = await device({ kind: "bucket", name: "" });
    ok(supplier.body?.code === "ST13-TBC" && downstream.body?.code === "CX1-FIK-1-TBC"
      && downstream.body.parent === "CX1-FIK" && bucket.body?.code === "CX1-FIK-R" && bucket.body.vault === null,
      "blank-locality device/pair: supplier, downstream and nameless resale account retain their role and parent rules");
    const before = pair().revision;
    const unknown = await device({ name: "Test Unknown", locality: "Unknown invented locality" });
    const ambiguous = await device({ name: "Test Ambiguous", locality: "Bandar Baru" });
    const badLink = await device({ name: "Test Link", link: "https://evil.test/maps?ll=3,101" });
    ok(!unknown.body && /not on the official list/.test(unknown.status)
      && !ambiguous.body && /more than one place/.test(ambiguous.status)
      && !badLink.body && /Maps or Waze/.test(badLink.status) && pair().revision === before,
      "blank-locality device/pair: supplied unknown/ambiguous locality and invalid exact link still refuse before writing: "
        + JSON.stringify([unknown.status, ambiguous.status, badLink.status]));
    const linked = await device({ name: "Test Pin", link: "Invented road https://waze.com/ul?ll=3.123456,101.654321" });
    const pin = (await crypt(JSON.parse(pair().places), true))["CT8-TBC"];
    ok(linked.body?.code === "CT8-TBC" && !Object.hasOwn(linked.body, "geo")
      && pin?.lat === 3.123456 && pin.lng === 101.654321 && pin.addr === "Invented road" && pin.src === "waze"
      && !JSON.stringify(linked.body).includes("3.123456"),
      "blank-locality device/pair: a supplied exact Waze point remains encrypted without inventing an approximate locality");
    const official = await device({ name: "Test Local", locality: "Pudu" });
    const localName = (await crypt(JSON.parse(pair().names), true))["CT10-PUD"];
    ok(official.body?.code === "CT10-PUD" && official.body.geo?.join() === "3.13,101.72" && localName === "Test Local (Pudu)"
      && draft(official.body.at)?.entry.payload.geo?.join() === official.body.geo.join(),
      "blank-locality device/pair: supplied official locality still derives its own code, sealed words and rounded queued point");
    const original = linked.body || official.body;
    const revision = pair().revision;
    const malformed = await call({ ...original, at: "2026-10-08T02:00:00.000Z", code: "CT9-TBC",
      geo: [0, 101], pair: { ...original?.pair, expectedRevision: revision } });
    const prose = await call({ ...original, at: "2026-10-08T02:01:00.000Z", code: "CT9-TBC",
      locality: "Private invented road", pair: { ...original?.pair, expectedRevision: revision } });
    ok(malformed.status === 400 && prose.status === 400 && pair().revision === revision
      && !draft("2026-10-08T02:00:00.000Z") && !draft("2026-10-08T02:01:00.000Z"),
      "blank-locality bridge: a supplied invalid point or plaintext locality still refuses before pair/outbox/draft writes");
  } finally { sqlite.close(); }
}
