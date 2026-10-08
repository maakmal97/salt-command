import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { webcrypto } from "node:crypto";
import { JSDOM } from "jsdom";
import { landingPage } from "../stmt/page.js";
import { handleMaker } from "../stmt/maker.js";
import worker from "../src/worker.js";
import { makerTradeBatch } from "../src/maker-inputs.js";
import { plan } from "../tools/fold.mjs";
import E from "../engine/position.mjs";
import { openMaster } from "../tools/payload.mjs";

const AT = "2099-10-05T01:00:00.000Z";
const body = (patch = {}) => ({ at: AT, product: "salt", party: "CX1-ZED", date: "2099-10-05",
  qty: 1, total: 130, cash: 170, movedUnits: 1, handover: "delivered", delivery: 40,
  extras: [{ product: "oil", qty: 2, total: 30, cash: 30, movedUnits: 2 }], ...patch });
const book = () => ({ version: "trade-fixture", sales: [], purchases: [],
  state: { PRODUCTS: { salt: {}, oil: {}, spare: { retired: true } },
    roster: ["CX1-ZED", "AX1-ZED", "AX1-ZED-R", "SX1-ZED"], associates: ["AX1-ZED"] },
  pricing: { v: "trade-fixture", byProduct: { salt: { stockCost: 40 }, oil: { stockCost: 8 } } } });

export function world() {
  const sqlite = new DatabaseSync(":memory:"), b = book();
  for (const f of readdirSync(new URL("../migrations/", import.meta.url)).filter((s) => /^[0-9]+_.*[.]sql$/.test(s)).sort())
    sqlite.exec(readFileSync(new URL("../migrations/" + f, import.meta.url), "utf8"));
  for (const [k, v] of Object.entries({ ...b.state, PRICING: b.pricing }))
    sqlite.prepare("INSERT INTO state(key,doc) VALUES (?,?)").run(k, JSON.stringify(v));
  sqlite.exec("INSERT INTO snapshot(one,v,stamped) VALUES (1,'trade-fixture',NULL)");
  const bound = (st, args) => ({ run() { return { meta: { changes: Number(st.run(...args).changes) } }; },
    first() { return st.get(...args) || null; }, all() { return { results: st.all(...args) }; } });
  const d1 = { prepare(sql) { const st = sqlite.prepare(sql); return Object.assign(bound(st, []), { bind: (...a) => bound(st, a) }); },
    batch(list) { sqlite.exec("BEGIN IMMEDIATE"); try { const out = list.map((s) => s.run()); sqlite.exec("COMMIT"); return out; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; } } };
  const map = new Map(), puts = [];
  const kv = { get: async (k, type) => { const v = map.get(k) ?? null; return type === "json" && v ? JSON.parse(v) : v; },
    put: async (k, v) => { puts.push([k, v]); map.set(k, v); }, delete: async (k) => map.delete(k),
    list: async ({ prefix = "" } = {}) => ({ keys: [...map.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
  const key = "counter-trades-fixture-key-0123456789", calls = [];
  const desk = { SALT_LEDGER: d1, SALT_QUEUE: kv, COUNTER_MAKER_KEY: key };
  const counter = { COUNTER_MAKER_KEY: key, DESK_MAKER: { fetch(request) {
    calls.push(new URL(request.url).pathname); return worker.fetch(request, desk, { waitUntil() {} });
  } } };
  const call = (p, value, identity = { email: "maakmal97@icloud.com" }) =>
    handleMaker(new Request("https://counter.test" + p, value === undefined ? {} : {
      method: "POST", body: JSON.stringify(value) }), counter, p, identity);
  const drafts = () => sqlite.prepare("SELECT * FROM draft ORDER BY id").all().map((r) =>
    ({ ...r, row: JSON.parse(r.row), entry: JSON.parse(r.entry), flags: JSON.parse(r.flags) }));
  return { sqlite, b, kv, map, puts, desk, calls, call, drafts };
}

export async function run({ ok, pageWork }) {
  const b = book(), made = makerTradeBatch("sale", body(), b);
  const { w } = await openMaster();
  let incumbent;
  try {
    w.eval("qPost=function(){return Promise.resolve(true)};qDownload=function(){return true};qFlush=function(){return Promise.resolve(true)};");
    w.eval("switchTab('add');wbMode='new';wbApply();");
    w.eval("document.querySelector('.ptile[data-p=\"oil\"]').click();document.querySelector('.ptile[data-p=\"salt\"]').click();");
    w.eval("(function(){queue.length=0;var s=function(id,v){var e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));};"
      + "s('wbPartyTxt','CA2-SEN');s('wbDate','2099-10-05');s('wbHand','delivered');"
      + "s('wbQty','1');s('wbTotal','130');s('wbCash','170');s('wbUnits','1');s('wbDelivery','40');"
      + "s('wbQty_oil','2');s('wbTotal_oil','30');s('wbCash_oil','30');s('wbUnits_oil','2');document.getElementById('wbRec').click();})()");
    incumbent = JSON.parse(w.eval("JSON.stringify(queue.map(function(e){var p=Object.assign({},e.payload);delete p.trip;return p;}))"));
  } finally { w.close(); }
  const incumbentBook = book(); incumbentBook.state.roster.push("CA2-SEN");
  const replacement = makerTradeBatch("sale", body({ party: "CA2-SEN" }), incumbentBook);
  const replacementPayloads = replacement.entries?.map((e) => { const p = { ...e.payload }; delete p.trip; return p; });
  const want = [E.tradeEntry({ at: AT, product: "salt", direction: "SELL", party: "CX1-ZED", date: "2099-10-05",
    qty: 1, total: 130, cash: 170, movedUnits: 1, delivery: 40, handover: "delivered", trip: "t" + Date.parse(AT) }),
  E.tradeEntry({ at: "2099-10-05T01:00:00.001Z", product: "oil", direction: "SELL", party: "CX1-ZED", date: "2099-10-05",
    qty: 2, total: 30, cash: 30, movedUnits: 2, handover: "delivered", trip: "t" + Date.parse(AT) })];
  ok(JSON.stringify(made.entries) === JSON.stringify(want) && incumbent?.length === 2
    && JSON.stringify(incumbent) === JSON.stringify(replacementPayloads),
    "multi-book constructor: the Workbench's native tradeEntry shapes, distinct moments and first-row carriage are preserved");
  const r2 = makerTradeBatch("sale", body({ party: "AX1-ZED", assoc: "AX1-ZED", stream: "R2", downstream: "CX1-ZED" }), b);
  ok(r2.drafts?.length === 2 && r2.drafts.every((d) => d.row.customer === "AX1-ZED-R" && d.row.rev === "R2" && d.row.downstream === "CX1-ZED"),
    "multi-book R2: both native drafts book to the associate bucket, not to the named buyer");
  const r3 = makerTradeBatch("sale", body({ assoc: "AX1-ZED", stream: "R3" }), b);
  ok(r3.drafts?.[0].row.ref === "AX1-ZED" && !r3.drafts?.[1].row.ref,
    "multi-book R3: the introduction belongs to the active row only, as on the Workbench");
  const noDelivery = makerTradeBatch("sale", body({ delivery: 0, cash: 130 }), b);
  const purchase = makerTradeBatch("purchase", { ...body({ handover: "delivered" }), delivery: undefined, freight: 0 }, b);
  // An absent field, not a sale-only field whose value happens to be undefined.
  const buy = body({ handover: "delivered" }); delete buy.delivery; buy.freight = 0;
  const bought = makerTradeBatch("purchase", buy, b);
  ok(noDelivery.entries?.length === 2 && noDelivery.entries.every((e) => !e.payload.trip)
    && bought.entries?.length === 2 && bought.entries.every((e) => e.type === "BUY" && !e.payload.trip)
    && !!purchase.error,
    "multi-book without delivery: independent sales and purchases carry no trip, and purchase fields remain closed");
  for (const extras of [
    [{ ...body().extras[0], product: "salt" }], [{ ...body().extras[0], product: "spare" }],
    [{ ...body().extras[0], qty: "2" }], [{ ...body().extras[0], delivery: 5 }],
    [{ ...body().extras[0], party: "SX1-ZED" }], [{ ...body().extras[0], date: "2099-10-06" }],
    [{ ...body().extras[0], trip: "t1" }]
  ]) {
    const wd = world();
    try {
      const response = await wd.call("/all/maker/inputs/sale", body({ extras }));
      ok(response.status === 400 && wd.drafts().length === 0 && wd.puts.length === 0,
        "multi-book invalid extra: the actual route refuses the whole input before writes " + JSON.stringify(extras));
    } finally { wd.sqlite.close(); }
  }
  const wd = world();
  try {
    const denied = await wd.call("/all/maker/inputs/sale", body(), null);
    const noKey = await worker.fetch(new Request("https://desk.test/_internal/maker/inputs/sale", {
      method: "POST", body: JSON.stringify(body()) }), wd.desk, { waitUntil() {} });
    ok(denied.status === 403 && noKey.status === 404 && wd.puts.length === 0,
      "multi-book boundary: owner and capability checks still refuse before writes");
    const first = await wd.call("/all/maker/inputs/sale", body()), answer = await first.json(), rows = wd.drafts();
    const queuePut = wd.puts.filter(([k]) => k.startsWith("q:"));
    ok(first.status === 200 && rows.length === 2 && rows.every((r) => r.status === "pending")
      && answer.drafts?.length === 2 && queuePut.length === 1 && JSON.parse(queuePut[0][1]).queue.length === 2
      && rows[0].row.delivery === 40 && !rows[1].row.delivery && rows[0].row.trip === rows[1].row.trip
      && rows[0].row.cost === 40 && rows[1].row.cost === 16,
      "multi-book route: one atomic queue document reaches two native pending drafts with product-specific costs and one delivery");
    const retry = await wd.call("/all/maker/inputs/sale", body()), clash = await wd.call("/all/maker/inputs/sale", body({ total: 131 }));
    ok(retry.status === 200 && JSON.stringify(await retry.json()) === JSON.stringify(answer)
      && clash.status === 409 && wd.drafts().length === 2,
      "multi-book retry: the whole request has one immutable answer and changed content cannot reuse it");
    wd.sqlite.prepare("UPDATE maker_request SET response=NULL WHERE id=?").run(AT);
    const recovered = await wd.call("/all/maker/inputs/sale", body());
    ok(recovered.status === 200 && (await recovered.json()).drafts?.length === 2 && wd.drafts().length === 2,
      "multi-book recovery: a lost final receipt resumes every retained entry, not just the first draft");
    const tap = await wd.call("/all/maker/drafts/" + encodeURIComponent(AT) + "/approve", {});
    ok(tap.status === 200 && wd.drafts().every((r) => r.status === "approved") && (await tap.json()).trip?.length === 1,
      "multi-book approval: the real bridge/native Worker approves both rows in one tap");
    const foldedBook = JSON.parse(readFileSync(new URL("../ledger/book.json", import.meta.url), "utf8"));
    foldedBook.sales = []; foldedBook.roster = b.state.roster;
    const approved = wd.drafts().map((r) => ({ id: r.id, collection: r.collection, row: r.row, entry: r.entry }));
    const good = plan(foldedBook, { ok: true, count: 2, approved }, null);
    const bad = structuredClone(approved); if (bad[1]) bad[1].row.delivery = 5;
    const refused = plan(foldedBook, { ok: true, count: 2, approved: bad }, null);
    ok(good.items.length === 2 && good.refused.length === 0 && E.partyOwedRM(rows.map((r) => ({ ...r.row, cash: 0 })), "CX1-ZED") === 200
      && refused.items.length === 0 && refused.refused.length === 2,
      "multi-book fold: both route rows fold whole, owed counts carriage once, and a second delivery holds the whole trip");
  } finally { wd.sqlite.close(); }

  const deviceWorld = world();
  deviceWorld.sqlite.prepare("INSERT INTO entry(collection,seq,hash,doc) VALUES ('sales',0,'trade-twin',?)")
    .run(JSON.stringify({ rid: "s900", customer: "CX1-ZED", product: "oil", date: "2099-10-05",
      qty: 2, total: 30, cash: 30, deliveredQty: 2 }));
  let work;
  const dom = new JSDOM(landingPage("", "trade-nonce", { master: "fixture-master", accounts: [] }), {
    url: "https://counter.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(win) {
      Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true });
      win.TextEncoder = TextEncoder; win.TextDecoder = TextDecoder; win.scrollTo = () => {};
      win.confirm = () => true;
      win.fetch = (path, init = {}) => String(path).startsWith("/all/maker/inputs") || String(path).startsWith("/all/maker/drafts/")
        ? deviceWorld.call(String(path), init.body ? JSON.parse(init.body) : undefined)
        : String(path) === "/all/maker/review"
          ? Promise.resolve(new Response(JSON.stringify({ ok: true, orders: [], drafts: deviceWorld.drafts(), refused: [] })))
          : Promise.resolve(new Response(JSON.stringify({ ok: true, accounts: [], orders: [], drafts: [], claims: [], threads: [],
            pools: [], config: null, status: { open: true } })));
      work = pageWork(win);
    }
  });
  try {
    dom.window.document.querySelector('button[data-m="maker"]').click(); await work.quiet();
    const section = [...dom.window.document.querySelectorAll("#makerInputs .maker-input")].find((s) => s.querySelector("h3")?.textContent === "Sale or purchase");
    const button = (root, label) => [...root.querySelectorAll("button")].find((e) => e.textContent === label);
    button(section, "Add another book")?.click();
    await work.quiet();
    const extra = section.querySelector(".maker-extra-trade");
    if (extra) {
      const fields = section.querySelectorAll(":scope > label input");
      ["2099-10-05", "1", "130", "170", "1", "40"].forEach((value, i) => { fields[i].value = value; });
      const selects = section.querySelectorAll(":scope > label select"); selects[3].value = "delivered";
      ["2", "30", "30", "2"].forEach((value, i) => { extra.querySelectorAll("input")[i].value = value; });
      button(section, "Send trade for review").click(); await work.quiet();
    }
    const rows = deviceWorld.drafts();
    ok(extra && rows.length === 2 && rows[0].row.delivery === 40 && rows[1].row.product === "oil" && !rows[1].row.delivery
      && rows[1].row.qty === 2 && rows[1].row.cash === 30 && rows[1].row.deliveredQty === 2 && rows[1].entry.payload.second === "s900",
      "multi-book owner UI: actual generated controls submit independent second-book figures through the real bridge/drafter " +
        JSON.stringify({ rows: rows.map((r) => r.row), status: section?.querySelector('[role="status"]')?.textContent, calls: deviceWorld.calls }));
    const approve = button(dom.window.document, "Approve trip");
    ok(approve && /2 rows waiting/.test(dom.window.document.body.textContent) && /one tap/.test(section.textContent),
      "multi-book owner review: the actual page labels the trip decision and shows the waiting siblings");
    if (approve) { approve.click(); await work.quiet(); }
    ok(!!approve && deviceWorld.drafts().length === 2 && deviceWorld.drafts().every((r) => r.status === "approved"),
      "multi-book owner tap: the generated Approve trip button decides both actual drafts");
    button(section, "Remove book")?.click();
    ok(extra && !section.querySelector(".maker-extra-trade"),
      "multi-book owner removal: Remove book actually removes its fields from the submitted trade");
    await work.quiet();
    const direction = section.querySelector("select");
    direction.value = "purchase"; direction.dispatchEvent(new dom.window.Event("change"));
    button(section, "Add another book")?.click(); await work.quiet();
    const buyExtra = section.querySelector(".maker-extra-trade");
    if (buyExtra) {
      const fields = section.querySelectorAll(":scope > label input");
      ["2099-10-05", "1", "130", "130", "1", "0"].forEach((value, i) => { fields[i].value = value; });
      ["2", "30", "30", "2"].forEach((value, i) => { buyExtra.querySelectorAll("input")[i].value = value; });
      button(section, "Send trade for review").click(); await work.quiet();
    }
    const lots = deviceWorld.drafts().filter((r) => r.collection === "purchases");
    ok(lots.length === 2 && lots.every((r) => r.status === "pending" && !r.row.trip && !r.row.delivery)
      && lots[0].row.receivedQty === 1 && lots[1].row.product === "oil" && lots[1].row.receivedQty === 2,
      "multi-book owner purchase: actual controls send two native lots with separate units and no customer trip");
    ok(E.vaultPendingOk({ path: "/all/maker/inputs/sale", body: body() })
      && !E.vaultPendingOk({ path: "/all/maker/inputs/sale", body: body({ extras: [{ ...body().extras[0], note: "unchecked prose" }] }) }),
      "multi-book device recovery: the whole safe batch is retainable and an extra cannot hide prose");
  } finally { dom.window.close(); deviceWorld.sqlite.close(); }
}
