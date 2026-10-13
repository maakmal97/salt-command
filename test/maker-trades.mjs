import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { webcrypto } from "node:crypto";
import { JSDOM } from "jsdom";
import { landingPage } from "../stmt/page.js";
import { handleMaker } from "../stmt/maker.js";
import worker from "../src/worker.js";
import { runDrafter } from "../src/drafter.js";
import { makerTradeBatch } from "../src/maker-inputs.js";
import { plan } from "../tools/fold.mjs";
import E from "../engine/position.mjs";
import { openMaster } from "../tools/payload.mjs";
import { answerSheets, tile, tileGroup } from "./maker-act.mjs";

const AT = "2099-10-05T01:00:00.000Z";
const body = (patch = {}) => ({ at: AT, product: "salt", party: "CX1-ZED", date: "2099-10-05",
  qty: 1, total: 130, cash: 170, movedUnits: 1, handover: "delivered", delivery: 40,
  extras: [{ product: "oil", qty: 2, total: 30, cash: 30, movedUnits: 2 }], ...patch });
const book = () => ({ version: "trade-fixture", sales: [], purchases: [],
  state: { PRODUCTS: { salt: {}, oil: {}, spare: { retired: true } },
    roster: ["CX1-ZED", "AX1-ZED", "AX1-ZED-R", "SX1-ZED", "CA1-ZED", "CA1-ZED-R"], associates: ["AX1-ZED", "CA1-ZED"] },
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

const button = (root, label) => [...root.querySelectorAll("button")].find((e) => e.textContent === label);
const field = (root, label) => [...root.querySelectorAll("label")]
  .find((e) => e.firstChild.textContent === label)?.querySelector("input,select");
export async function ownerTrade(wd, pageWork, cover) {
  const sent = [];
  let work, loseAnswer = false, tick = Date.parse(AT);
  const dom = new JSDOM(landingPage("", "trade-nonce", { master: "fixture-master", accounts: [] }), {
    url: "https://counter.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(win) {
      Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true });
      win.TextEncoder = TextEncoder; win.TextDecoder = TextDecoder; win.scrollTo = () => {};
      const NativeDate = win.Date;
      win.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [tick += 100])); } };
      win.fetch = async (path, init = {}) => {
        if (cover && String(path) === "/all/maker/trade-cover") return cover(JSON.parse(init.body));
        if (String(path) === "/all/maker/trade-reading") return wd.call(String(path), JSON.parse(init.body));
        if (String(path).startsWith("/all/maker/inputs") || String(path).startsWith("/all/maker/drafts/")) {
          const input = init.body && JSON.parse(init.body);
          if (input) sent.push({ path: String(path), bytes: init.body, body: input });
          const response = await wd.call(String(path), input || undefined);
          if (loseAnswer && String(path) === "/all/maker/inputs/sale") {
            loseAnswer = false; throw new Error("Fixture lost the completed response.");
          }
          return response;
        }
        return new Response(JSON.stringify(String(path) === "/all/maker/review"
          ? { ok: true, orders: [], drafts: wd.drafts(), refused: [] }
          : { ok: true, accounts: [], orders: [], drafts: [], claims: [], threads: [],
            pools: [], config: null, status: { open: true } }));
      };
      work = pageWork(win);
    }
  });
  answerSheets(dom.window, [], () => true);   /* a twin is put to him on the page's Sheet (Phase 2c) and answered yes as it comes up */
  dom.window.document.querySelector('button[data-act="nav.record"]').click(); await work.quiet();
  const section = [...dom.window.document.querySelectorAll("#makerInputs .maker-input")]
    .find((s) => s.querySelector("h3")?.textContent === "Sale or purchase");
  button(section, "Another book on this visit").click(); await work.quiet();
  for (const [label, value] of Object.entries({ Date: "2099-10-05", Units: "1",
    "Price (goods)": "130", "Cash received": "0", "Units handed over": "1",
    "Delivery": "40" })) field(section, label).value = value;
  tile(section, "Handover", "delivered");
  const extra = section.querySelector(".maker-extra-trade");
  for (const [label, value] of Object.entries({ Units: "2", "Price (goods)": "30",
    "Cash received": "0", "Units handed over": "2" })) field(extra, label).value = value;
  const change = (label, value) => {
    if (tileGroup(section, label)) { tile(section, label, value); return; }   /* a few, fixed choices are tiles, and a tap on one is the change */
    const control = field(section, label); control.value = value;
    control.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  };
  const send = async () => { (button(section, "Send the sale") || button(section, "Send the purchase")).click(); await work.quiet(); };
  return { dom, section, sent, work, change, send, lose: () => { loseAnswer = true; } };
}

function foldRows(wd) {
  const foldedBook = JSON.parse(readFileSync(new URL("../ledger/book.json", import.meta.url), "utf8"));
  foldedBook.sales = []; foldedBook.roster = wd.b.state.roster;
  const approved = wd.drafts().filter((r) => r.status === "approved")
    .map((r) => ({ id: r.id, collection: r.collection, row: r.row, entry: r.entry }));
  return plan(foldedBook, { ok: true, count: approved.length, approved }, null);
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
      win.fetch = (path, init = {}) => String(path).startsWith("/all/maker/inputs") || String(path).startsWith("/all/maker/drafts/")
        ? deviceWorld.call(String(path), init.body ? JSON.parse(init.body) : undefined)
        : String(path) === "/all/maker/review"
          ? Promise.resolve(new Response(JSON.stringify({ ok: true, orders: [], drafts: deviceWorld.drafts(), refused: [] })))
          : Promise.resolve(new Response(JSON.stringify({ ok: true, accounts: [], orders: [], drafts: [], claims: [], threads: [],
            pools: [], config: null, status: { open: true } })));
      work = pageWork(win);
    }
  });
  answerSheets(dom.window, [], () => true);
  try {
    dom.window.document.querySelector('button[data-act="nav.record"]').click(); await work.quiet();
    const section = [...dom.window.document.querySelectorAll("#makerInputs .maker-input")].find((s) => s.querySelector("h3")?.textContent === "Sale or purchase");
    const button = (root, label) => [...root.querySelectorAll("button")].find((e) => e.textContent === label);
    button(section, "Another book on this visit")?.click();
    await work.quiet();
    const extra = section.querySelector(".maker-extra-trade");
    if (extra) {
      const fields = section.querySelectorAll(":scope > label input");
      ["2099-10-05", "1", "130", "170", "1", "40"].forEach((value, i) => { fields[i].value = value; });
      tile(section, "Handover", "delivered");
      ["2", "30", "30", "2"].forEach((value, i) => { extra.querySelectorAll("input:not([type=radio])")[i].value = value; });
      button(section, "Send the sale").click(); await work.quiet();
    }
    const rows = deviceWorld.drafts();
    ok(extra && rows.length === 2 && rows[0].row.delivery === 40 && rows[1].row.product === "oil" && !rows[1].row.delivery
      && rows[1].row.qty === 2 && rows[1].row.cash === 30 && rows[1].row.deliveredQty === 2 && rows[1].entry.payload.second === "s900",
      "multi-book owner UI: actual generated controls submit independent second-book figures through the real bridge/drafter " +
        JSON.stringify({ rows: rows.map((r) => r.row), status: section?.querySelector('[role="status"]')?.textContent, calls: deviceWorld.calls }));
    const approve = button(dom.window.document, "Approve both");
    ok(approve && /Two books, one trip/.test(dom.window.document.body.textContent) && /one tap/.test(section.textContent),
      "multi-book owner review: the actual page labels the trip decision and shows the waiting siblings");
    if (approve) { approve.click(); await work.quiet(); }
    ok(!!approve && deviceWorld.drafts().length === 2 && deviceWorld.drafts().every((r) => r.status === "approved"),
      "multi-book owner tap: the generated Approve trip button decides both actual drafts");
    button(section, "Remove")?.click();
    ok(extra && !section.querySelector(".maker-extra-trade"),
      "multi-book owner removal: Remove book actually removes its fields from the submitted trade");
    await work.quiet();
    tile(section, "Sale or purchase", "purchase");
    button(section, "Another book on this visit")?.click(); await work.quiet();
    const buyExtra = section.querySelector(".maker-extra-trade");
    if (buyExtra) {
      const fields = section.querySelectorAll(":scope > label input");
      ["2099-10-05", "1", "130", "130", "1", "0"].forEach((value, i) => { fields[i].value = value; });
      ["2", "30", "30", "2"].forEach((value, i) => { buyExtra.querySelectorAll("input:not([type=radio])")[i].value = value; });
      button(section, "Send the purchase").click(); await work.quiet();
    }
    const lots = deviceWorld.drafts().filter((r) => r.collection === "purchases");
    ok(lots.length === 2 && lots.every((r) => r.status === "pending" && !r.row.trip && !r.row.delivery)
      && lots[0].row.receivedQty === 1 && lots[1].row.product === "oil" && lots[1].row.receivedQty === 2,
      "multi-book owner purchase: actual controls send two native lots with separate units and no customer trip");
    ok(E.vaultPendingOk({ path: "/all/maker/inputs/sale", body: body() })
      && !E.vaultPendingOk({ path: "/all/maker/inputs/sale", body: body({ extras: [{ ...body().extras[0], note: "unchecked prose" }] }) }),
      "multi-book device recovery: the whole safe batch is retainable and an extra cannot hide prose");
  } finally { dom.window.close(); deviceWorld.sqlite.close(); }

  const receiptWorld = world(), receiptPage = await ownerTrade(receiptWorld, pageWork);
  try {
    await receiptPage.send();
    const original = receiptPage.sent.find((s) => s.path.endsWith("/sale"));
    const approve = button(receiptPage.dom.window.document, "Approve both");
    if (approve) { approve.click(); await receiptPage.work.quiet(); }
    for (const [i, row] of foldRows(receiptWorld).items.entries())
      receiptWorld.sqlite.prepare("INSERT INTO entry(collection,seq,hash,doc) VALUES ('sales',?,?,?)")
        .run(i, "confirmed-" + i, JSON.stringify(row.row));
    receiptWorld.sqlite.exec("UPDATE draft SET committed_at='2099-10-05T02:00:00.000Z'");
    receiptWorld.sqlite.prepare("INSERT INTO state(key,doc) VALUES ('QUEUE_COMMITTED',?)")
      .run(JSON.stringify(receiptWorld.drafts().at(-1).id));
    await runDrafter(receiptWorld.desk);
    await receiptPage.send();
    const requests = receiptPage.sent.filter((s) => s.path.endsWith("/sale"));
    ok(original && requests[1]?.body.at !== original.body.at
      && requests.at(-1)?.body.second && requests.at(-1)?.body.extras[0].second
      && receiptWorld.drafts().length === 4,
      "multi-book confirmed receipt: an identical intentional second batch gets fresh ids and its own twin confirmations " +
        JSON.stringify({ requests, rows: receiptWorld.drafts().map((r) => r.row), answer: receiptPage.section.textContent }));
  } finally { receiptPage.dom.window.close(); receiptWorld.sqlite.close(); }

  const lostWorld = world(), lostPage = await ownerTrade(lostWorld, pageWork);
  try {
    lostPage.lose(); await lostPage.send();
    const saved = lostPage.dom.window.localStorage.getItem("saltMakerPending:/all/maker/inputs/sale");
    field(lostPage.section, "Price (goods)").value = "999";
    field(lostPage.section, "Price (goods)").dispatchEvent(new lostPage.dom.window.Event("input", { bubbles: true }));
    await lostPage.send();
    const requests = lostPage.sent.filter((s) => s.path.endsWith("/sale"));
    ok(saved && requests.length === 2 && requests[0].bytes === requests[1].bytes && lostWorld.drafts().length === 2
      && lostWorld.drafts()[0].row.total === 130
      && !lostPage.dom.window.localStorage.getItem("saltMakerPending:/all/maker/inputs/sale"),
      "multi-book lost answer: edited controls retry the original whole batch byte-for-byte until confirmation");
  } finally { lostPage.dom.window.close(); lostWorld.sqlite.close(); }

  for (const [stream, buyer] of [["R2", "CX1-ZED"], ["R2", ""], ["R3", null]]) {
    const attributed = world(), page = await ownerTrade(attributed, pageWork);
    try {
      page.change("Through an associate?", stream); page.change("Which associate", "CA1-ZED");
      if (stream === "R2") page.change("Their customer (optional)", buyer);
      const party = [...page.section.querySelectorAll(":scope > label")].find((e) => e.contains(field(page.section, stream === "R3" ? "Buyer" : "Who")));
      ok((stream === "R2" ? party?.hidden && !field(page.section, "Their customer (optional)").parentElement.hidden
        : !party?.hidden && field(page.section, "Their customer (optional)").parentElement.hidden)
        && field(page.section, "Which associate").value === "CA1-ZED",
        "multi-book attribution controls: " + stream + " exposes its own party/end-customer conditions " + String(buyer));
      await page.send();
      const request = page.sent.find((s) => s.path.endsWith("/sale")), rows = attributed.drafts();
      ok(request?.body.stream === stream && request.body.assoc === "CA1-ZED" && rows.length === 2
        && (stream === "R2"
          ? request.body.party === "CA1-ZED" && rows.every((r) => r.row.customer === "CA1-ZED-R"
            && r.row.rev === "R2" && (r.row.downstream || null) === (buyer || null))
          : request.body.party === "CX1-ZED" && rows.every((r) => r.row.customer === "CX1-ZED")
            && rows[0].row.ref === "CA1-ZED" && !rows[1].row.ref),
        "multi-book attributed UI route: " + stream + " owner controls reach real bridge/Worker/native drafts " + String(buyer) +
          JSON.stringify({ request, rows: rows.map((r) => r.row), answer: page.section.textContent }));
      const approve = button(page.dom.window.document, "Approve both");
      if (approve) { approve.click(); await page.work.quiet(); }
      const folded = foldRows(attributed), sales = folded.items.map((item) => item.row);
      ok(approve && attributed.drafts().every((r) => r.status === "approved")
        && folded.refused.length === 0 && sales.length === 2
        && (stream === "R2"
          ? sales.every((r) => r.customer === "CA1-ZED-R" && r.rev === "R2" && (r.downstream || null) === (buyer || null))
            && E.partyOwedRM(sales, "CA1-ZED-R") === 200 && E.partyOwedRM(sales, "CX1-ZED") === 0
          : sales.every((r) => r.customer === "CX1-ZED") && sales[0].ref === "CA1-ZED" && !sales[1].ref
            && E.partyOwedRM(sales, "CX1-ZED") === 200 && E.partyOwedRM(sales, "CA1-ZED") === 0),
        "multi-book attributed approval/fold: " + stream + " books the correct account and credits no downstream buyer " + String(buyer));
      page.change("Sale or purchase", "purchase");
      ok(page.section.querySelector(".maker-trade-attribution").hidden
        && !field(page.section, "Who").parentElement.hidden,
        "multi-book attribution purchase boundary: sale-only controls disappear and Party returns " + stream + String(buyer));
    } finally { page.dom.window.close(); attributed.sqlite.close(); }
  }

  const choicesWorld = world();
  choicesWorld.sqlite.prepare("INSERT INTO state(key,doc) VALUES ('INTRODUCTIONS',?)")
    .run(JSON.stringify([{ by: "CX1-ZED" }, { by: "SX1-ZED" }]));
  choicesWorld.sqlite.prepare("INSERT INTO state(key,doc) VALUES ('PEOPLE',?)")
    .run(JSON.stringify({ banned: [{ id: "SX1-ZED" }] }));
  const choicesPage = await ownerTrade(choicesWorld, pageWork);
  try {
    choicesPage.change("Through an associate?", "R2");
    const r2Choices = [...field(choicesPage.section, "Which associate").options].map((o) => o.value);
    choicesPage.change("Through an associate?", "R3");
    const r3Choices = [...field(choicesPage.section, "Which associate").options].map((o) => o.value);
    ok(!r2Choices.includes("CX1-ZED") && r3Choices.includes("CX1-ZED") && !r3Choices.includes("SX1-ZED"),
      "multi-book associate catalog: actual controls include the incumbent introduction bench, exclude bans and require an R2 bucket");
  } finally { choicesPage.dom.window.close(); choicesWorld.sqlite.close(); }

  for (const scenario of [
    { name: "buyer", direction: "sale", field: "Who",
      error: "Choose a buyer on the roster. Register a new buyer under Counter Admin > Add ID first, then pick the code.",
      plain: "Choose a customer from the list. A new customer is added under Record, New customer, first." },
    { name: "supplier", direction: "purchase", field: "Who",
      error: "Choose a supplier on the roster. Register a new supplier under Counter Admin > Add ID first, then pick the code.",
      plain: "Choose a supplier from the list. A new supplier is added under Record, New customer, first." },
    { name: "end buyer", direction: "sale", stream: "R2", field: "Their customer (optional)",
      error: "Choose an end buyer on the roster, or leave End customer as Not named. Register a new end buyer under Counter Admin > Add ID first, then pick the code.",
      plain: "Choose their customer from the list, or leave it as Not named. A new customer is added under Record, New customer, first." },
    { name: "referrer", direction: "sale", stream: "R3", field: "Which associate",
      error: "Choose a referrer on the roster. Register a new referrer under Counter Admin > Add ID first, then pick the code.",
      plain: "Choose who introduced the buyer from the list. A new one is added under Record, New customer, first." },
    { name: "associate", direction: "sale", stream: "R2", field: "Which associate",
      error: "Choose an associate on the roster. Register a new associate under Counter Admin > Add ID first, then pick the code.",
      plain: "Choose an associate from the list. A new one is added under Record, New customer, first." }
  ]) {
    const refusedWorld = world(), page = await ownerTrade(refusedWorld, pageWork);
    try {
      if (scenario.direction === "purchase") page.change("Sale or purchase", "purchase");
      if (scenario.stream) {
        page.change("Through an associate?", scenario.stream); page.change("Which associate", "CA1-ZED");
      }
      const forged = page.dom.window.document.createElement("option");
      forged.value = "CZ9-ZED"; forged.textContent = "CZ9-ZED";
      field(page.section, scenario.field).appendChild(forged);
      field(page.section, scenario.field).value = forged.value;
      await page.send();
      const request = page.sent.find((s) => s.path.endsWith("/" + scenario.direction));
      const counts = ["maker_request", "input_admission", "input_admission_source", "draft"]
        .map((table) => refusedWorld.sqlite.prepare("SELECT COUNT(*) AS n FROM " + table).get().n);
      ok(request && (scenario.field === "Their customer (optional)" ? request.body.downstream
        : scenario.field === "Which associate" ? request.body.assoc : request.body.party) === "CZ9-ZED"
        && refusedWorld.calls.includes("/_internal/maker/inputs/" + scenario.direction)
        && page.section.querySelector('[role="status"]').firstChild.textContent === scenario.plain
        && page.section.querySelector('[role="status"] .rraw').textContent === scenario.error
        && counts.every((n) => n === 0) && refusedWorld.puts.length === 0,
        "trade unknown " + scenario.name + ": forged generated-owner input reaches the real bridge/Worker, shows precise Add ID guidance and writes no queue, draft or admission " +
          JSON.stringify({ request, calls: refusedWorld.calls, counts, answer: page.section.querySelector('[role="status"]').textContent }));
    } finally { page.dom.window.close(); refusedWorld.sqlite.close(); }
  }
}

export async function runCoverRead({ ok, pageWork }) {
  const wd = world(), reads = [];
  let gate = null, mode = "offer";
  const page = await ownerTrade(wd, pageWork, async (input) => {
    reads.push(input);
    if (gate) await gate.promise;
    return mode === "fail" ? Response.json({ ok: false, error: "The Desk did not answer." }, { status: 503 })
      : Response.json({ ok: true, cover: { rm: 30, units: 0.75, free: 1, ask: 130 } });
  });
  try {
    const check = page.section.querySelector("[data-reward-cover]"), label = check.parentNode;
    const note = () => label.parentNode.nextElementSibling.firstChild?.textContent ?? "", raw = () => label.parentNode.nextElementSibling.querySelector(".rraw")?.textContent;
    page.change("Price (goods)", "130"); await page.work.quiet();
    ok(!label.hidden && !check.disabled && !check.checked && /Use 0[.]75 unit of their reward: RM 30[.]00 off/.test(label.textContent) && reads.length === 1,
      "cover read: the first answer offers an unticked cover, and the read asked for the typed figures " + JSON.stringify(reads));
    check.checked = true;
    let release; gate = { promise: new Promise((resolve) => { release = resolve; }) };
    page.change("Price (goods)", "131");
    const mid = { hidden: label.hidden, disabled: check.disabled, ticked: check.checked, reads: reads.length, words: label.textContent };
    release(); gate = null; await page.work.quiet();
    ok(mid.reads === 2 && mid.hidden === false && mid.disabled && !mid.ticked && /Checking[.]/.test(mid.words)
      && !label.hidden && !check.disabled && /RM 30[.]00 off/.test(label.textContent),
      "cover read: a read in flight keeps the offered box at its place, unticked and disabled, so the tap on Send beside it is not moved "
        + JSON.stringify({ mid, now: label.textContent }));
    mode = "fail"; page.change("Price (goods)", "132"); await page.work.quiet();
    const retry = [...page.section.querySelectorAll("button")].find((e) => e.textContent === "Read again");
    ok(retry && !retry.hidden && !retry.disabled && !label.hidden && check.disabled && !check.checked
      && /Reward not read/.test(label.textContent) && note() === "The Counter could not do that. Try again." && raw() === "The Desk did not answer." && reads.length === 3,
      "cover read: a failed read keeps the box with its note and an enabled retry beside it");
    mode = "offer"; retry?.click(); await page.work.quiet();
    ok(retry && reads.length === 4 && JSON.stringify(reads[3]) === JSON.stringify(reads[2])
      && !label.hidden && !check.disabled && retry.hidden && note() === "" && /RM 30[.]00 off/.test(label.textContent),
      "cover read: the retry reads the same figures again and, on an answer, offers the cover and drops itself");
  } finally { page.dom.window.close(); wd.sqlite.close(); }
}
