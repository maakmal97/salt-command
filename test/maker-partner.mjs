/* Salt Admin: Make partner (B2 of #62), the Desk's partnerMake entry through its own drafter and fold. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { webcrypto } from "node:crypto";
import { JSDOM } from "jsdom";
import { makerInputCatalog, makerPartner } from "../src/maker-inputs.js";
import { handleMaker } from "../stmt/maker.js";
import { landingPage } from "../stmt/page.js";
import { contentKey, wrapKey } from "../tools/stmt-crypto.mjs";
import POSITION_ENGINE from "../engine/position.mjs";
import { draftRow } from "../src/drafter.js";
import { openMaster } from "../tools/payload.mjs";
import { pricingSnapshot } from "../tools/book.mjs";

const at = "2026-10-01T08:00:00.000Z";
const book = () => ({
  version: 1, sales: [], purchases: [],
  state: {
    PRODUCTS: { salt: { name: "salt" }, oil: { name: "oil" } },
    roster: ["CX1-ZED", "CX2-ZED", "CX3-ZED", "AX1-ZED", "AX1-ZED-R", "SP1-ZED"],
    associates: ["CX2-ZED"], partners: ["CX3-ZED"],
    PROD_OPENING: { salt: { qty: 0, costPerKg: null }, oil: { qty: 0, costPerKg: null } }, PEOPLE: { departed: [] }
  },
  pricing: { tierNames: [], byProduct: {
    salt: { stockCost: 40, inputs: { policy: { tierRule: { drift: { up: 0.3, down: 0.2 } } } } },
    oil: { stockCost: 8, inputs: { policy: { tierRule: { fixed: true } } } } } }
});

export async function run({ ok, KV, worker, REPO } = {}) {
  const check = ok || ((condition, message) => { if (!condition) throw new Error(message); });
  const drafted = (c) => draftRow(POSITION_ENGINE.partnerEntry({ at, code: c }), { ...book(), state: { ...book().state, roster: [...book().state.roster, c] } });
  const mirror = book(), make = (code, b = mirror) => makerPartner({ at, code }, b);
  /* 1. equal to the Desk: the real master's partnerMake is driven for a plain customer and for an associate, and Maker is asked for the same */
  const { w } = await openMaster();
  try {
    w.eval("queue=[];render=function(){};renderQueue=function(){};saveQueue=function(){return Promise.resolve(true);};applyOverlay=function(){};");
    const snap = JSON.parse(w.eval("JSON.stringify({PRODUCTS:PRODUCTS,roster:roster,associates:associates,partners:partners})"));
    const real = { version: "fixture", sales: [], purchases: [], pricing: pricingSnapshot(w), state: snap };
    const fit = (id) => /^C/.test(id) && !/-Gen$/.test(id) && !POSITION_ENGINE.isBucket(id) && !snap.partners.includes(id);
    const plain = snap.roster.find((id) => fit(id) && !snap.associates.includes(id)), member = snap.roster.find((id) => fit(id) && snap.associates.includes(id));
    for (const id of [plain, member]) {
    }
    check(makerPartner({ at, code: snap.partners[0] }, real).error === snap.partners[0] + " is already a partner.", "the Desk's own partner is refused as already one");
  } finally { w.close(); }
  const fixedOnly = book(); fixedOnly.pricing.byProduct.salt.inputs.policy.tierRule = { fixed: true };
  const levelBook = book(); levelBook.pricing.byProduct.salt.inputs.policy.tierRule = { multiples: [1, 2] };
  check(make("CX1-ZED", fixedOnly).error === "A partner is made on a book with a Set Price." && !!make("CX1-ZED", levelBook).error,
    "a book with no Set Price refuses it");
  const waiting = POSITION_ENGINE.partnerEntry({ at: "2026-10-01T07:00:00.000Z", code: "CX1-ZED" });
  check(makerPartner({ at, code: "CX1-ZED" }, mirror, [waiting]).twin === true && !makerPartner({ at, code: "CX2-ZED" }, mirror, [waiting]).error
    && !makerPartner({ at: waiting.at, code: "CX1-ZED" }, mirror, [waiting]).error,
  "a partner already waiting under Approve for that code refuses a second request, and not its own retry or another code");
  check(!!drafted("CX1-ZED-2-ABC").skip && !drafted("CX1-ZED").skip, "an end buyer's code is refused by the drafter's partner clause");
  check(make("CX3-ZED").error === "CX3-ZED is already a partner.", "a party already a partner is refused");
  check(!!make("AX1-ZED-R").error && !!make("NOPE-ZED").error && !!makerPartner({ at, code: "CX1-ZED", name: "x" }, mirror).error
    && !!makerPartner({ at: "now", code: "CX1-ZED" }, mirror).error,
  "a resale account, an unknown code, a stray field and a loose timestamp are refused");
  const catalog = makerInputCatalog(mirror, {}, [make("CX1-ZED").entry]);
  check(catalog.partners.join() === "CX3-ZED" && catalog.partnerWaiting.join() === "CX1-ZED",
    "the catalog names who is a partner and who waits under Approve");

  const forwarded = [], key = "counter-maker-test-key-0123456789abcdef";
  const env = { COUNTER_MAKER_KEY: key, DESK_MAKER: { fetch: async (request) => {
    forwarded.push({ path: new URL(request.url).pathname, key: request.headers.get("X-Counter-Maker-Key"), body: await request.json() });
    return new Response(JSON.stringify({ ok: true, queued: true, status: "pending" }), { headers: { "content-type": "application/json" } });
  } } };
  const post = (e, who) => handleMaker(new Request("https://counter.test/all/maker/inputs/partner", { method: "POST",
    headers: { "content-type": "application/json" }, body: JSON.stringify({ at, code: "CX1-ZED" }) }), e, "/all/maker/inputs/partner", who);
  const sent = await post(env, { email: "maakmal97@icloud.com" });
  check(sent.status === 200 && forwarded.at(-1).path === "/_internal/maker/inputs/partner" && forwarded.at(-1).key === key
    && forwarded.at(-1).body.code === "CX1-ZED", "the owner's route reaches the named Desk bridge with the bridge key");
  const before = forwarded.length;
  check((await post(env, { email: "someone@example.com" })).status === 403 && (await post(env, null)).status === 403
    && forwarded.length === before, "any other identity is refused before the bridge");
  let unbridged = 0;
  try { unbridged = (await post({ DESK_MAKER: env.DESK_MAKER }, { email: "maakmal97@icloud.com" })).status; } catch (e) { unbridged = 500; }
  check(unbridged >= 400 && forwarded.length === before, "without the bridge key nothing is forwarded");

  /* 2. the real Desk worker behind the bridge: one pending roster draft, a retry once, a clash refused, refused off a drift book */
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(":memory:");
  try {
    for (const file of readdirSync(join(REPO, "migrations")).filter((f) => /^[0-9]+_.*[.]sql$/.test(f)).sort())
      db.exec(readFileSync(join(REPO, "migrations", file), "utf8"));
    const d1 = { batch(statements) {
      db.exec("BEGIN IMMEDIATE");
      try { const r = statements.map((s) => s.run()); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; }
    }, prepare(sql) {
      const st = db.prepare(sql);
      const bound = (a) => ({ run() { return { meta: { changes: Number(st.run(...a).changes) } }; },
        first() { return st.get(...a) || null; }, all() { return { results: st.all(...a) }; } });
      return Object.assign(bound([]), { bind: (...a) => bound(a) });
    } };
    const put = (k, v) => db.prepare("INSERT OR REPLACE INTO state(key,doc) VALUES (?,?)").run(k, JSON.stringify(v));
    const seed = (m) => { for (const [k, v] of Object.entries({ ...m.state, PRICING: m.pricing })) put(k, v); };
    seed(mirror); db.prepare("INSERT OR REPLACE INTO snapshot(one,v,stamped) VALUES (1,'b2-fixture',NULL)").run();
    const deskEnv = { COUNTER_MAKER_KEY: key, SALT_QUEUE: new KV(), SALT_LEDGER: d1 };
    const bridged = [];
    const counter = { COUNTER_MAKER_KEY: key, DESK_MAKER: { fetch: (request) => {
      bridged.push(new URL(request.url).pathname); return worker.fetch(request, deskEnv, { waitUntil() {} });
    } } };
    const owner = { email: "  MAAKMAL97@ICLOUD.COM " };
    const call = (body, who = owner) => handleMaker(new Request("https://counter.test/all/maker/inputs/partner", { method: "POST", body: JSON.stringify(body) }),
      counter, "/all/maker/inputs/partner", who);
    const drafts = () => db.prepare("SELECT id,collection,status,row FROM draft").all();
    const noKey = await worker.fetch(new Request("https://desk.test/_internal/maker/inputs/partner", { method: "POST",
      body: JSON.stringify({ at, code: "CX1-ZED" }) }), deskEnv, { waitUntil() {} });
    check((await call({ at, code: "CX1-ZED" }, { email: "other@example.com" })).status === 403 && noKey.status === 404 && drafts().length === 0,
      "another identity and a Desk call without the bridge key write nothing");
    const first = await call({ at, code: "CX1-ZED" }), firstBody = await first.json();
    check(first.status === 200 && firstBody.ok && drafts().length === 1 && drafts()[0].collection === "roster" && drafts()[0].status === "pending"
      && JSON.parse(drafts()[0].row).partner === true, "the owner's Make partner crosses the bridge to one pending roster draft with partner set");
    const retry = await call({ at, code: "CX1-ZED" }), retryBody = await retry.json();
    check(retry.status === 200 && retryBody.ok && retryBody.queued === false && drafts().length === 1, "a retry under the same request id lands once");
    check((await call({ at, code: "CX2-ZED" })).status === 409 && drafts().length === 1, "the same request id for a different customer is refused");
    check((await call({ at: "2026-10-01T08:30:00.000Z", code: "CX1-ZED" })).status === 409 && drafts().length === 1, "a second tap for a customer already waiting under Approve lands no second draft")
    check((await call({ at: "2026-10-01T09:00:00.000Z", code: "CX3-ZED" })).status === 400 && drafts().length === 1, "a customer already a partner is refused at the Desk");
    const flat = book(); flat.pricing.byProduct.salt.inputs.policy.tierRule = { fixed: true }; seed(flat);
    check((await call({ at: "2026-10-01T10:00:00.000Z", code: "CX1-ZED" })).status === 400 && drafts().length === 1, "off a drift book the Desk refuses it and queues nothing");
  } finally { db.close(); }
  check(POSITION_ENGINE.vaultPendingOk({ path: "/all/maker/inputs/partner", body: { at, code: "CX1-ZED" } })
    && !POSITION_ENGINE.vaultPendingOk({ path: "/all/maker/inputs/partner-x", body: { at, code: "CX1-ZED" } }),
  "a partner request is a retained device entry, and a path beside it is not");

  const content = await contentKey("4".repeat(64), "maker-partner");
  const adminOpen = { ok: true, byMaster: true, session: "", wrapMaster: await wrapKey("fixture-master", content) };
  const calls = []; let failOnce = true;
  const context = { ok: true, products: ["salt"], catalog: { products: [{ product: "salt", drift: true }],
    parties: ["CX1-ZED", "CX3-ZED", "AX1-ZED", "SP1-ZED"], tierCustomers: [], driftCustomers: ["CX1-ZED", "CX3-ZED", "AX1-ZED"],
    driftCards: [], tierNames: [], partners: ["CX3-ZED"], partnerWaiting: [] } };
  /* 26 Oct 2026: Make partner stands on the customer's own card under Customers, so the page knows the accounts */
  const accts = [{ username: "aaaa-bbbb", code: "CX1-ZED" }, { username: "cccc-dddd", code: "CX3-ZED" }, { username: "eeee-ffff", code: "AX1-ZED" }];
  const sheetRow = (a) => ({ ...a, account: true, t: { owed: 0, toGet: 0, refund: 0, pend: 0 }, flag: "clear", seen: { opens: 1, last: "2026-10-10T08:00:00.000Z", how: "link" }, sent: "2026-10-10T08:00:00.000Z" });
  const dom = new JSDOM(landingPage("", "maker-partner-nonce", { master: "fixture-master", accounts: accts }), {
    url: "https://site.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(win) {
      Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true });
      win.TextEncoder = TextEncoder; win.TextDecoder = TextDecoder; win.scrollTo = () => {};
      win.fetch = async (path, init) => {
        const route = String(path), body = init?.body ? JSON.parse(init.body) : null;
        if (route === "/all/maker/inputs/partner") {
          calls.push({ route, body });
          if (failOnce) { failOnce = false; return { ok: false, status: 503, json: async () => ({ ok: false, error: "Retry this retained input." }) }; }
        }
        const data = route === "/open" ? adminOpen : route === "/all/maker/inputs" ? context
          : route === "/all/maker/review" ? { ok: true, orders: [], drafts: [] }
            : route === "/all/maker/hours" ? { ok: true, config: null, status: { open: true, source: "default" } }
              : route === "/all/sheet" ? { ok: true, accounts: accts.map(sheetRow) } : route.startsWith("/all/maker/drift-preview/") ? { ok: true, preview: { rows: [] } }
                : { ok: true, accounts: [], orders: [], drafts: [], refs: [], tiers: [] };
        return { ok: true, status: 200, json: async () => data };
      };
    } });
  const waitFor = async (p) => { for (let i = 0; i < 100 && !p(); i++) await new Promise((r) => setTimeout(r, 10)); return p(); };
  try {
    const doc = dom.window.document;
    doc.querySelector('[data-act="nav.customers"]').click(); doc.querySelector('[data-act="part.customers.accounts"]').click();
    const open = async (code) => { await waitFor(() => [...doc.querySelectorAll("#rlist [data-u]")].some((c) => c.querySelector(".need-who")?.textContent === code));
      [...doc.querySelectorAll("#rlist [data-u]")].find((c) => c.querySelector(".need-who").textContent === code).click();
      await waitFor(() => doc.querySelector("#aopen .apart, #aopen .amore .apct")); return doc.querySelector("#aopen .oacct"); };
    const three = await open("CX3-ZED"), three2 = three && three.querySelector(".apart");
    const assoc = await open("AX1-ZED"), assocPart = !!(assoc && assoc.querySelector('[data-act="acct.partner"]'));
    const one = await open("CX1-ZED"), section = one && one.querySelector(".apart"), button = section && section.querySelector('[data-act="acct.partner"]');
    check(!!button && button.textContent === "Make partner", "the owner page renders the Partner control on the customer's card");
    check(!!three2 && /Partner/.test(three2.querySelector(".salt-status").textContent) && !three2.querySelector('[data-act="acct.partner"]') && !assocPart,
      "a partner shows as one and is not offered again; only customers are offered it");
    const tap = async () => { button.click(); await new Promise((r) => setTimeout(r, 0)); button.click(); };
    await tap();
    await waitFor(() => calls.length === 1 && !button.disabled);
    check(calls.length === 1, "the first tap asks, the second is sent");
    const kept = dom.window.localStorage.getItem("saltMakerPending:/all/maker/inputs/partner");
    check(kept && JSON.parse(kept).body.code === "CX1-ZED", "an unconfirmed send is retained whole on the phone");
    await tap();
    check(await waitFor(() => calls.length === 2 && !button.disabled) && JSON.stringify(calls[0].body) === JSON.stringify(calls[1].body)
      && !dom.window.localStorage.getItem("saltMakerPending:/all/maker/inputs/partner"),
    "the retry sends the retained request unchanged, once, and clears it on confirmation");
    await tap();
    check(await waitFor(() => calls.length === 3) && calls[2].body.at !== calls[1].body.at, "a later intentional tap is a fresh request");
  } finally { dom.window.close(); }
}
