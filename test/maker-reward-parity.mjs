import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { JSDOM } from "jsdom";
import { landingPage } from "../stmt/page.js";
import { readBook, pricingSnapshot } from "../tools/book.mjs";
import { readBook as mirrorBook } from "../src/drafter.js";
import { plan, apply } from "../tools/fold.mjs";
import { queueSale, queueResourceTrades } from "../src/orders.js";
import { admitInputs } from "../src/input-admission.js";
import E from "../engine/position.mjs";
import { world } from "./maker-trades.mjs";

const copy = (value) => JSON.parse(JSON.stringify(value));
const seal = (text) => ({ v: 1, salt: Buffer.alloc(16, 1).toString("base64"),
  iv: Buffer.alloc(12, 2).toString("base64"), ct: Buffer.from(text.padEnd(16, ".")).toString("base64") });
const master = () => readFileSync(process.env.SALT_MASTER || new URL("../master/salt_command.html", import.meta.url), "utf8");
const section = (doc, title) => [...doc.querySelectorAll("#makerInputs .maker-input")]
  .find((node) => node.querySelector("h3")?.textContent === title);
const button = (root, text) => [...root.querySelectorAll("button")].find((node) => node.textContent === text);
const field = (root, text) => [...root.querySelectorAll("label")]
  .find((node) => (node.querySelector(".lbl")?.textContent || node.firstChild.textContent) === text)?.querySelector("input,select");

export async function fixture() {
  const source = await readBook(), wd = world(), codes = ["CX1-ZED", "CX2-ZED", "CX3-ZED", "CX4-ZED", "CA1-ZED", "CA1-ZED-R"];
  const sale = (id, code, more = {}) => ({ rid: id, customer: code, date: "2099-09-01", qty: 20,
    total: 2800, cash: 2800, cost: 800, deliveredQty: 20, deliveredOn: "2099-09-01", ...more });
  const rows = [sale("earn1", codes[0]), sale("earn2", codes[1], { coverUnits: 1.56, coverRM: 62.4 }),
    sale("earn3", codes[2]), sale("earn4", codes[3]), sale("earna", codes[4]),
    { rid: "advance", customer: codes[3], date: "2099-09-02", qty: 2, total: 300, cash: 0, cost: 80,
      deliveredQty: 2, deliveredOn: "2099-09-02" }];
  try {
    source.w.eval(`sales.splice(0,sales.length,...${JSON.stringify(rows)});
      BASE_SALES.splice(0,BASE_SALES.length,...${JSON.stringify(rows)});
      purchases.length=0;BASE_PURCHASES.length=0;INTRODUCTIONS.length=0;
      roster.splice(0,roster.length,...${JSON.stringify(codes)});associates.splice(0,associates.length,'CA1-ZED');
      PEOPLE.departed=[{id:'CX3-ZED'}];PEOPLE.banned=[];
      PROD_OPENING.salt.qty=100;PROD_OPENING.salt.costPerKg=40;
      REWARD.stated.salt.margin=1000;REWARD.stated.salt.associate.margin=1000;
      TIER_OF['CX1-ZED']={salt:-0.3};TIER_OF['CA1-ZED']={salt:-0.3};PROD='salt';recompute();`);
    const pricing = pricingSnapshot(source.w);
    pricing.v = wd.b.version;
    const state = { ...copy(source.ledger), PRODUCTS: { salt: {}, oil: {} }, roster: codes,
      associates: ["CA1-ZED"], INTRODUCTIONS: [], R0_NETWORK: {}, PEOPLE: { departed: [{ id: "CX3-ZED" }], banned: [] },
      PROD_OPENING: { salt: { qty: 100, costPerKg: 40 } },
      REWARD: { stated: { salt: { margin: 1000, associate: { margin: 1000 } } } }, PRICING: pricing };
    for (const [key, value] of Object.entries(state))
      wd.sqlite.prepare("INSERT OR REPLACE INTO state(key,doc) VALUES (?,?)").run(key, JSON.stringify(value));
    for (const [seq, row] of rows.entries())
      wd.sqlite.prepare("INSERT INTO entry(collection,seq,hash,doc) VALUES ('sales',?,'fixture',?)").run(seq, JSON.stringify(row));
    const ask = source.w.eval("cardQuote('CX1-ZED',1)");
    const nativeCover = JSON.parse(source.w.eval(`JSON.stringify(coverPlan('CX1-ZED',1,${ask - 30}))`));
    const date = source.w.eval("TODAY.toISOString().slice(0,10)");
    const nativeRedeem = (code) => JSON.parse(source.w.eval(`(function(){queue=[];
      saveQueue=function(){};qPost=function(){return Promise.resolve(false)};switchTab=function(){};
      redeemRebate('${code}');return JSON.stringify(queue[0]||null)})()`));
    const foldBook = copy(source.ledger);
    foldBook.sales = copy(rows); foldBook.purchases = []; foldBook.roster = codes;
    foldBook.associates = ["CA1-ZED"]; foldBook.PEOPLE = state.PEOPLE; foldBook.INTRODUCTIONS = [];
    foldBook.PROD_OPENING = state.PROD_OPENING; foldBook.REWARD = state.REWARD; foldBook.QUEUE_COMMITTED = "2099-01-01T00:00:00.000Z";
    const trade = (at, patch = {}) => ({ at, product: "salt", party: "CX1-ZED", date: "2099-10-05",
      qty: 1, total: ask - 30, cash: 0, movedUnits: 1, handover: "delivered", delivery: 40, ...patch });
    return { ...wd, source, ask, nativeCover, date, nativeRedeem, foldBook, trade };
  } catch (error) { source.w.close(); wd.sqlite.close(); throw error; }
}

async function owner(wd, pageWork) {
  let work, lose = false;
  const sent = [], dom = new JSDOM(landingPage("", "reward-parity", { master: "fixture", accounts: [] }), {
    url: "https://counter.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(win) {
      Object.defineProperty(win, "crypto", { value: webcrypto });
      win.TextEncoder = TextEncoder; win.TextDecoder = TextDecoder; win.scrollTo = () => {}; win.confirm = () => true;
      const NativeDate = win.Date;
      let tick = Date.parse("2099-10-05T01:00:00.000Z");
      win.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [tick += 100])); } };
      win.fetch = async (path, init = {}) => {
        if (/^\/all\/maker\/(inputs|trade-cover|drafts)/.test(String(path))) {
          const body = init.body && JSON.parse(init.body);
          if (body) sent.push({ path, body, bytes: init.body });
          const response = await wd.call(String(path), body);
          if (lose && path === "/all/maker/inputs/sale") { lose = false; throw new Error("Answer lost after drafting."); }
          return response;
        }
        return Response.json({ ok: true, accounts: [], orders: [], drafts: [], claims: [], threads: [], pools: [], offers: [],
          config: null, status: {}, bulletin: { lines: [] } });
      };
      work = pageWork(win);
    }
  });
  dom.window.document.querySelector('[data-m="maker"]').click(); await work.quiet();
  const set = (root, name, value) => {
    const node = field(root, name); node.value = value;
    node.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    if (node.tagName === "SELECT") node.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  };
  return { dom, doc: dom.window.document, work, sent, set, lose: () => { lose = true; } };
}

export async function run({ ok, pageWork }) {
  const wd = await fixture();
  let ui;
  try {
    ui = await owner(wd, pageWork);
    const rewards = () => section(ui.doc, "Reward redemption");
    const holder = (code) => rewards().querySelector('[data-reward-holder="' + code + '"]');
    ok(button(holder("CX1-ZED"), "Redeem 1 unit for CX1-ZED") && !holder("CX2-ZED").querySelector("button")
      && /0.44 unit held/.test(holder("CX2-ZED").textContent),
    "generated owner offers one whole customer unit at two, and no action at .44");
    ok(/2 unit held while departed/.test(holder("CX3-ZED").textContent) && !holder("CX3-ZED").querySelector("button"),
      "generated owner keeps departed earnings visible and offers no spend");
    ok(button(holder("CX4-ZED"), "Offset reward for CX4-ZED"),
      "generated owner names Offset for the customer holding an advance");
    wd.sqlite.prepare("UPDATE state SET doc=? WHERE key='PEOPLE'").run(JSON.stringify({ departed: [], banned: [] }));
    wd.foldBook.PEOPLE = { departed: [], banned: [] };
    button(rewards(), "Read reward offers").click(); await ui.work.quiet();
    ok(button(holder("CX3-ZED"), "Redeem 1 unit for CX3-ZED"), "returning restores the actual generated redemption offer");
    ui.set(rewards(), "Date", wd.date);
    const native = wd.nativeRedeem("CX4-ZED");
    button(holder("CX4-ZED"), "Offset reward for CX4-ZED")?.click(); await ui.work.quiet();
    const offset = wd.drafts().find((d) => d.entry.payload.party === "CX4-ZED");
    ok(offset && JSON.stringify(offset.entry.payload) === JSON.stringify(native.payload)
      && offset.entry.payload.rid === "advance" && offset.status === "pending",
    "owner Offset crosses the real bridge to the native oldest-advance draft with unchanged payload");
    if (offset) await wd.call("/all/maker/drafts/" + encodeURIComponent(offset.id) + "/approve", {});
    const offsetBook = copy(wd.foldBook), offsetBefore = JSON.stringify(offsetBook.sales.filter((s) => s.rid !== "advance"));
    const offsetDraft = wd.drafts().find((d) => d.id === offset?.id && d.status === "approved");
    const offsetStage = { ok: true, count: offsetDraft ? 1 : 0, approved: offsetDraft ? [{
      id: offsetDraft.id, collection: "sales", amends: offsetDraft.amends, amendKind: offsetDraft.amend_kind,
      row: offsetDraft.row, entry: offsetDraft.entry }] : [] };
    const offsetResult = apply(offsetBook, offsetStage, { version: "v9999", date: "05 Oct 2099", title: "OFFSET TEST",
      notes: ["<b>TEST.</b> Nothing real."], rows: {}, stockNote: "" }, master());
    ok(offsetDraft && offsetResult.ok && offsetBook.sales.find((s) => s.rid === "advance").rebateKg === 1
      && JSON.stringify(offsetBook.sales.filter((s) => s.rid !== "advance")) === offsetBefore,
    "actual offset approval and fold spend one customer unit on that row and leave other sales unchanged");
    button(holder("CX3-ZED"), "Redeem 1 unit for CX3-ZED")?.click();await ui.work.quiet();
    const redemption = wd.drafts().find((d) => d.entry.payload.mode === "redeem" && d.entry.payload.party === "CX3-ZED");
    if (redemption) await wd.call("/all/maker/drafts/" + encodeURIComponent(redemption.id) + "/approve", {});
    const redeemDraft = wd.drafts().find((d) => d.id === redemption?.id && d.status === "approved");
    const redeemBook = copy(wd.foldBook), redeemBefore = JSON.stringify(redeemBook.sales);
    const redeemStage = { ok: true, count: redeemDraft ? 1 : 0, approved: redeemDraft ? [{
      id: redeemDraft.id, collection: "sales", row: redeemDraft.row, entry: redeemDraft.entry }] : [] };
    const redeemed = apply(redeemBook, redeemStage, { version: "v9999", date: "05 Oct 2099", title: "REDEMPTION TEST",
      notes: ["<b>TEST.</b> Nothing real."], rows: redemption ? { [redemption.id]: { note: "Test redemption." } } : {}, stockNote: "" }, master());
    const redeemedRow = redeemBook.sales.find((s) => !wd.foldBook.sales.some((prior) => prior.rid === s.rid));
    ok(redeemDraft && redeemed.ok && redemption.entry.payload.qty === 1
      && redeemedRow?.customer === "CX3-ZED" && redeemedRow.qty === 1 && redeemedRow.rebate
      && JSON.stringify(redeemBook.sales.filter((s) => s.rid !== redeemedRow.rid)) === redeemBefore,
    "returned holder's generated redemption approves and folds exactly one whole unit, no other sales changed");

    const trade = section(ui.doc, "Sale or purchase");
    for (const [name, value] of Object.entries({ Party: "CX1-ZED", Date: "2099-10-05", Units: "1",
      "Goods total (RM)": String(wd.ask - 30), "Units moved": "1", "Delivery (RM)": "40", Handover: "delivered" }))
      ui.set(trade, name, value);
    await ui.work.quiet();
    const cover = () => trade.querySelector("[data-reward-cover]");
    ok(cover() && !cover().parentNode.hidden && !cover().checked
      && trade.textContent.includes("Cover RM 30.00 with 0.75 unit reward")
      && wd.nativeCover.kg === 0.75 && wd.nativeCover.rm === 30,
    "generated cover is unticked and matches the native own-card gap at cost, delivery excluded");
    ui.set(trade, "Goods total (RM)", String(wd.ask)); await ui.work.quiet();
    ok(cover().parentNode.hidden, "a sale at its own quote generates no cover offer");
    ui.set(trade, "Goods total (RM)", String(wd.ask - 30));await ui.work.quiet();
    ui.set(trade, "Book", "oil"); await ui.work.quiet();
    ok(cover().parentNode.hidden, "a fixed nonreward book generates no cover offer");
    ui.set(trade, "Book", "salt");ui.set(trade, "Party", "CA1-ZED");await ui.work.quiet();
    ok(cover().parentNode.hidden, "an associate generates no customer cover offer");
    ui.set(trade, "Party", "CX1-ZED"); ui.set(trade, "Goods total (RM)", String(wd.ask - 30));await ui.work.quiet();
    ui.set(trade, "Date", "2099-10-04");
    button(trade, "Send trade for review").click();await ui.work.quiet();
    const unmarked = wd.drafts().find((d) => d.entry.payload.mode === "new");
    ok(unmarked && !unmarked.row.coverUnits && !unmarked.entry.payload.more,
      "the generated unticked trade sends no cover and reserves no reward");
    wd.desk.VAULT_STORE = "pair";
    wd.sqlite.prepare("INSERT INTO vault_pair(one,revision,names,places,updated) VALUES (1,1,?,?,?)")
      .run(JSON.stringify(seal("base-names")), null, "2099-10-05T01:30:00.000Z");
    const registrationAt = "2099-10-05T02:00:00.000Z", registrationVault = seal("encrypted-CX8-SEN");
    const registration = await wd.call("/all/maker/inputs/add-id", { at: registrationAt, code: "CX8-SEN",
      kind: "customer", parent: null, tiers: null, vault: registrationVault,
      pair: { expectedRevision: 1, names: registrationVault, places: null } });
    const refreshed = await (await wd.call("/all/maker/inputs")).json();
    const registeredTradeAt = "2099-10-05T02:00:00.001Z";
    const registeredTradeResponse = await wd.call("/all/maker/inputs/sale", {
      at: registeredTradeAt, product: "salt", party: "CX8-SEN", date: wd.date,
      qty: 1, total: wd.ask, cash: 0, movedUnits: 0, handover: null, delivery: 0
    });
    const registeredTrade = wd.drafts().find((d) => d.id === registeredTradeAt);
    ok(registration.status === 200 && refreshed.catalog.parties.includes("CX8-SEN")
      && registeredTradeResponse.status === 200 && registeredTrade?.entry.registrationDependencies?.[0]?.id === registrationAt,
      "pair-backed Add ID is returned by the refreshed native catalog and admits a server-stamped trade before fold");
    const reservationAt = "2099-10-05T02:00:00.002Z";
    const reservation = await wd.call("/all/maker/inputs/redeem",
      { at: reservationAt, code: "CX1-ZED", date: wd.date });
    ok(reservation.status === 200 && wd.drafts().some((d) => d.id === reservationAt && d.status === "pending"),
      "an actual pending redemption reserves reward capacity before the covered trade batch");
    ui.set(trade, "Date", "2099-10-05");
    button(trade, "Add another book").click();await ui.work.quiet();
    const extra = trade.querySelector(".maker-extra-trade");
    for (const [name, value] of Object.entries({ Units: "2", "Goods total (RM)": "30", "Units moved": "2" }))
      ui.set(extra, name, value);
    await ui.work.quiet();
    cover().checked = true;ui.lose();
    button(trade, "Send trade for review").click();await ui.work.quiet();
    const salePosts = () => ui.sent.filter((p) => p.path === "/all/maker/inputs/sale" && p.body.extras);
    const batch = wd.drafts().filter((d) => d.entry.payload.mode === "new" && d.row.trip);
    ok(batch.length === 2 && batch[0].row.coverUnits === 0.75 && batch[0].row.coverRM === 30
      && batch[0].entry.payload.coverFree === 1 && /covered by/.test(batch[0].entry.raw)
      && batch[0].row.delivery === 40 && !batch[1].row.delivery && batch[0].row.trip === batch[1].row.trip,
    "marked owner batch keeps pending reward reservations and one delivery on the unchanged trip carrier when verified registrations are present");
    ui.set(trade, "Goods total (RM)", "999");
    button(trade, "Send trade for review").click();await ui.work.quiet();
    ok(salePosts().length === 2 && salePosts()[0].bytes === salePosts()[1].bytes
      && wd.drafts().filter((d) => d.entry.payload.mode === "new" && d.row.trip).length === 2 && !cover().checked,
    "lost-answer owner retry sends immutable whole-batch bytes once and clears the checkbox on confirmation");
    const changed = await wd.call("/all/maker/inputs/sale", { ...salePosts()[0].body, total: 999 });
    ok(changed.status === 409, "changed input under the retained request timestamp is refused");
    const approval = await wd.call("/all/maker/drafts/" + encodeURIComponent(batch[0]?.id || "missing") + "/approve", {});
    const approved = wd.drafts().filter((d) => d.entry.payload.mode === "new" && d.row.trip && d.status === "approved");
    ok(approval.status === 200 && approved.length === 2,
      "the actual owner approval decides every covered trip row together");
    const staged = { ok: true, count: approved.length, approved: approved.map((d) => ({
      id: d.id, collection: d.collection, row: d.row, entry: d.entry })) };
    const book = copy(wd.foldBook), before = JSON.stringify(book.sales), planned = plan(book, staged, null);
    const folded = apply(book, staged, { version: "v9999", date: "05 Oct 2099", title: "REWARD TEST",
      notes: ["<b>TEST.</b> Nothing real."], rows: Object.fromEntries(approved.map((d) => [d.id, { note: "Test sale." }])),
      stockNote: "" }, master());
    ok(!planned.refused.length && folded.ok && JSON.stringify(book.sales.slice(0, wd.foldBook.sales.length)) === before
      && book.sales.some((s) => s.coverUnits === 0.75 && s.coverRM === 30 && s.total === wd.ask - 30),
    "native plan and apply fold the covered row without repricing it or changing any other sale: "
      + JSON.stringify({ refused: planned.refused, ok: folded.ok, problems: folded.problems }));
    button(rewards(), "Read reward offers").click();await ui.work.quiet();
    ok(!button(holder("CX1-ZED"), "Redeem 1 unit for CX1-ZED")
      && /0.25 unit available after reservations/.test(holder("CX1-ZED").textContent),
      "actual generated offers net approved cover and pending redemption reservations before offering another spend: "
        + JSON.stringify({ holder: holder("CX1-ZED").textContent, drafts: wd.drafts().map((d) => ({
          id: d.id, status: d.status, mode: d.entry.payload.mode, coverUnits: d.row.coverUnits,
          qty: d.row.qty, party: d.row.customer, product: d.row.product })) }));
    wd.sqlite.prepare("UPDATE state SET doc=? WHERE key='PRODUCTS'").run(JSON.stringify({
      salt: { reward: false }, oil: { reward: false } }));
    button(rewards(), "Read reward offers").click();await ui.work.quiet();
    ok(!rewards().querySelector("[data-reward-holder] button"),
      "a declared nonreward book exposes no generated redemption action");
  } finally { ui?.dom.window.close(); wd.source.w.close(); wd.sqlite.close(); }
}

export async function runExtra({ ok, pageWork }) {
  const extraCase = await fixture();
  let extraUi;
  try {
    extraUi = await owner(extraCase, pageWork);
    const trade = section(extraUi.doc, "Sale or purchase");
    for (const [name, value] of Object.entries({ Book: "oil", Party: "CX1-ZED", Date: "2099-10-05", Units: "2",
      "Goods total (RM)": "30", "Units moved": "2", "Delivery (RM)": "40", Handover: "delivered" }))
      extraUi.set(trade, name, value);
    button(trade, "Add another book").click();await extraUi.work.quiet();
    const extra = trade.querySelector(".maker-extra-trade");
    extraUi.set(extra, "Goods total (RM)", String(extraCase.ask - 30));extraUi.set(extra, "Units moved", "1");
    await extraUi.work.quiet();
    const check = extra.querySelector("[data-reward-cover]");
    ok(!check.parentNode.hidden && !check.checked && /Cover RM 30.00 with 0.75 unit/.test(extra.textContent),
      "the generated extra-book control offers native unticked cover when salt is not the trip carrier");
    check.checked = true;button(trade, "Send trade for review").click();await extraUi.work.quiet();
    const drafts = extraCase.drafts();
    if (drafts[0]) await extraCase.call("/all/maker/drafts/" + encodeURIComponent(drafts[0].id) + "/approve", {});
    const approved = extraCase.drafts().filter((d) => d.status === "approved");
    const staged = { ok: true, count: approved.length, approved: approved.map((d) => ({
      id: d.id, collection: d.collection, row: d.row, entry: d.entry })) };
    const book = copy(extraCase.foldBook), before = JSON.stringify(book.sales);
    const result = apply(book, staged, { version: "v9999", date: "05 Oct 2099", title: "EXTRA COVER TEST",
      notes: ["<b>TEST.</b> Nothing real."], rows: Object.fromEntries(approved.map((d) => [d.id, { note: "Test extra cover." }])),
      stockNote: "" }, master());
    ok(approved.length === 2 && result.ok && drafts[0].row.delivery === 40 && !drafts[1].row.delivery
      && drafts[1].row.coverUnits === 0.75 && drafts[1].row.coverRM === 30
      && JSON.stringify(book.sales.slice(0, extraCase.foldBook.sales.length)) === before
      && book.sales.some((s) => s.coverUnits === 0.75 && !s.delivery && s.total === extraCase.ask - 30),
      "extra-book marked cover crosses the bridge, trip approval and native fold without moving the carrier or other sales");
  } finally { extraUi?.dom.window.close();extraCase.source.w.close();extraCase.sqlite.close(); }
}

export async function runRecovery({ ok }) {
  const recovery = await fixture();
  try {
    const request = recovery.trade("2099-10-05T02:00:00.000Z", { cover: true,
      extras: [{ product: "oil", qty: 2, total: 30, cash: 0, movedUnits: 2 }] });
    const put = recovery.kv.put;let failOnce = true;
    recovery.kv.put = async (key, value) => {
      if (failOnce && key.startsWith("q:orders:")) { failOnce = false;throw new Error("Fixture queue write unavailable."); }
      return put(key, value);
    };
    const missed = await recovery.call("/all/maker/inputs/sale", request);
    const stored = recovery.sqlite.prepare("SELECT entry FROM maker_request WHERE id=?").get(request.at)?.entry;
    const held = recovery.sqlite.prepare("SELECT amount FROM input_admission WHERE id=? AND state='accepted'").get(request.at);
    ok(missed.status >= 500 && stored && held?.amount === 0.75 && !recovery.drafts().length
      && recovery.sqlite.prepare("SELECT id FROM input_admission_source WHERE id=? AND source='orders'").get(request.at),
      "failure before queue transport retains the immutable covered batch and its durable source reservation");
    const retry = await recovery.call("/all/maker/inputs/sale", request);
    ok(retry.status === 200 && recovery.drafts().length === 2
      && JSON.stringify(recovery.drafts().map((d) => d.entry)) === stored
      && recovery.sqlite.prepare("SELECT COUNT(*) AS n FROM input_admission WHERE state='accepted'").get().n === 1,
      "retry after queue-write failure drafts the retained whole batch once without another cover reservation");
  } finally { recovery.source.w.close();recovery.sqlite.close(); }
}

export async function runAdmission({ ok, worker }) {
  const race = await fixture();
  try {
    const at = "2099-10-05T03:00:00.000Z";
    const db = race.desk.SALT_LEDGER, batch = db.batch;
    const waiting = [];let concurrent = true, peak = 0;
    db.batch = async (statements) => {
      if (!concurrent) return batch(statements);
      return new Promise((resolve, reject) => {
        waiting.push(() => {
          try {
            const result = batch(statements);
            const ids = race.sqlite.prepare("SELECT id FROM input_admission WHERE state='accepted'").all();
            peak = Math.max(peak, ids.reduce((sum, row) => sum + (row.id === at ? 1
              : row.id === "2099-10-05T03:00:01.000Z" ? 1.5 : 0), 0));
            resolve(result);
          } catch (error) { reject(error); }
        });
        if (waiting.length === 2) { concurrent = false;waiting.forEach((commit) => commit()); }
      });
    };
    const result = await Promise.all([
      race.call("/all/maker/inputs/redeem", { at, code: "CX1-ZED", date: "2099-10-05" }),
      race.call("/all/maker/inputs/sale", race.trade("2099-10-05T03:00:01.000Z",
        { total: race.ask - 60, cover: true, extras: [{ product: "oil", qty: 2, total: 30, cash: 0, movedUnits: 2 }] }))
    ]);
    db.batch = batch;
    ok(result.filter((r) => r.status === 200).length === 1 && peak <= 2 && peak > 0
      && (race.drafts().length === 1 || race.drafts().length === 2),
    "concurrent redemption and covered batch share one native balance and cannot overdraw it");
    const before = JSON.stringify([...race.map]);
    const book = await mirrorBook(race.desk.SALT_LEDGER);
    const ownerConflict = E.redeemEntry({ at: "2099-10-05T03:59:59.000Z", product: "salt",
      party: "CX2-ZED", date: "2099-10-05", qty: 0.2, earned: 2, applied: 0, balance: 2 });
    race.sqlite.prepare("INSERT INTO maker_request(id,operation,fingerprint,entry) VALUES (?,?,?,?)")
      .run("queue-owner:" + ownerConflict.at, "queue-owner", "f".repeat(64),
        JSON.stringify({ device: "other-device", fingerprint: "f".repeat(64) }));
    const upload = await worker.fetch(new Request("https://desk.test/queue", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ device: "fixture-device", queue: [ownerConflict] })
    }), race.desk, { waitUntil() {} });
    ok(upload.status === 409
      && race.sqlite.prepare("SELECT state FROM input_admission WHERE id=?").get(ownerConflict.at)?.state === "withdrawn"
      && !race.sqlite.prepare("SELECT id FROM input_admission_source WHERE id=? AND source='device:fixture-device'").get(ownerConflict.at)
      && !race.map.has("q:fixture-device"),
    "an owner-receipt conflict releases only this upload's newly admitted resource source and never queues it");
    const entries = ["CX1-ZED", "CX4-ZED"].map((party, i) => E.redeemEntry({
      at: "2099-10-05T04:00:0" + i + ".000Z", product: "salt", party, date: "2099-10-05",
      qty: 3, earned: 2, applied: 0, balance: 2 }));
    const failure = await admitInputs(race.desk.SALT_LEDGER, entries, book, "device:fixture");
    ok(failure.error && !race.sqlite.prepare("SELECT id FROM input_admission WHERE id=?").get(entries[0].at)
      && !race.sqlite.prepare("SELECT id FROM input_admission_source WHERE id=?").get(entries[0].at)
      && JSON.stringify([...race.map]) === before,
    "an over-capacity batch leaves no partial claims, ownership or queue writes");
    const joint = ["2099-10-05T04:01:00.000Z", "2099-10-05T04:01:01.000Z"].map((at) => E.redeemEntry({
      at, product: "salt", party: "CX4-ZED", date: "2099-10-05", qty: 1.2, earned: 2, applied: 0, balance: 2 }));
    const jointResult = await admitInputs(race.desk.SALT_LEDGER, joint, book, "device:fixture");
    ok(jointResult.error && joint.every((entry) => !race.sqlite.prepare("SELECT id FROM input_admission WHERE id=?").get(entry.at)),
      "atomic admission rejects jointly excessive individually valid claims without inserting a prefix");
    const covered = E.tradeEntry({ at: "2099-10-05T05:00:00.000Z", product: "salt", party: "CX1-ZED",
      direction: "SELL", date: "2099-10-05", qty: 1, total: race.ask - 10, cash: 0, movedUnits: 1,
      more: { coverUnits: 0.25, coverRM: 10 }, coverFree: 2 });
    let refused = false;
    try { await queueSale(race.desk, [covered], true); } catch (error) { refused = error.status === 400; }
    ok(refused && !race.map.has("q:orders:" + covered.at),
      "ordinary-trade batch rejection remains authoritative for resource input");
    race.sqlite.prepare("INSERT INTO maker_request(id,operation,fingerprint) VALUES (?,?,?)")
      .run("queue-withdraw:" + covered.at, "queue-withdraw", "fixture");
    let fenced = false;
    try { await queueResourceTrades(race.desk, [covered]); } catch (error) { fenced = error.status === 409; }
    ok(fenced && !race.sqlite.prepare("SELECT id FROM input_admission WHERE id=?").get(covered.at),
      "the atomic covered-batch insert respects an existing withdrawal tombstone");
    const retained = E.redeemEntry({ at: "2099-10-05T06:00:00.000Z", product: "salt", party: "CX4-ZED",
      date: "2099-10-05", qty: 0.25, earned: 2.2, applied: 0, balance: 2.2 });
    await admitInputs(race.desk.SALT_LEDGER, [retained], book, "device:fixture");
    race.sqlite.prepare("INSERT INTO maker_request(id,operation,fingerprint) VALUES (?,?,?)")
      .run("queue-withdraw:" + retained.at, "queue-withdraw", "fixture");
    const replay = await admitInputs(race.desk.SALT_LEDGER, [retained], book, "orders");
    ok(replay.error && !race.sqlite.prepare("SELECT id FROM input_admission_source WHERE id=? AND source='orders'").get(retained.at),
      "a tombstoned retained admission cannot acquire a foreign source or return success on retry");
    const previous = E.redeemEntry({ ...retained.payload, at: "2099-10-05T07:00:00.000Z" });
    const fresh = E.redeemEntry({ ...retained.payload, at: "2099-10-05T07:00:01.000Z" });
    await admitInputs(race.desk.SALT_LEDGER, [previous], book, "device:fixture");
    let flip = true;
    const racingDb = { prepare: (...args) => race.desk.SALT_LEDGER.prepare(...args), async batch(statements) {
      const result = await race.desk.SALT_LEDGER.batch(statements);
      if (flip) { flip = false;race.sqlite.prepare("UPDATE snapshot SET v='changed' WHERE one=1").run(); }
      return result;
    } };
    const reseeded = await admitInputs(racingDb, [previous, fresh], book, "device:fixture");
    ok(reseeded.error && race.sqlite.prepare("SELECT state FROM input_admission WHERE id=?").get(fresh.at)?.state === "withdrawn"
      && !race.sqlite.prepare("SELECT id FROM input_admission_source WHERE id=?").get(fresh.at)
      && race.sqlite.prepare("SELECT state FROM input_admission WHERE id=?").get(previous.at)?.state === "accepted"
      && race.sqlite.prepare("SELECT id FROM input_admission_source WHERE id=? AND source='device:fixture'").get(previous.at),
      "a reseed during atomic admission releases only newly acquired ownership and preserves a retained source");
    race.sqlite.prepare("UPDATE snapshot SET v=? WHERE one=1").run(book.version);
    const competing = E.redeemEntry({ ...retained.payload, at: "2099-10-05T08:00:00.000Z" });
    let acquire = true;
    const competingDb = { prepare: (...args) => race.desk.SALT_LEDGER.prepare(...args), async batch(statements) {
      if (acquire) {
        acquire = false;
        await admitInputs(race.desk.SALT_LEDGER, [competing], book, "device:fixture");
      }
      const result = await race.desk.SALT_LEDGER.batch(statements);
      race.sqlite.prepare("UPDATE snapshot SET v='changed' WHERE one=1").run();
      return result;
    } };
    const concurrentRetry = await admitInputs(competingDb, [competing], book, "device:fixture");
    ok(concurrentRetry.error
      && race.sqlite.prepare("SELECT state FROM input_admission WHERE id=?").get(competing.at)?.state === "accepted"
      && race.sqlite.prepare("SELECT id FROM input_admission_source WHERE id=? AND source='device:fixture'").get(competing.at),
      "a reseed cannot release ownership acquired by a concurrent identical retry before this transaction");
    race.sqlite.prepare("UPDATE snapshot SET v=? WHERE one=1").run(book.version);
    const collision = E.redeemEntry({ ...retained.payload, at: "2099-10-05T09:00:00.000Z" });
    const conflicting = E.redeemEntry({ ...collision.payload, at: collision.at, qty: 0.5 });
    const collisionResult = await admitInputs(race.desk.SALT_LEDGER, [collision, conflicting], book, "device:fixture");
    ok(collisionResult.error && !race.sqlite.prepare("SELECT id FROM input_admission WHERE id=?").get(collision.at)
      && !race.sqlite.prepare("SELECT id FROM input_admission_source WHERE id=?").get(collision.at),
      "a conflicting timestamp inside one resource batch refuses before any prefix is reserved");
    const duplicate = E.redeemEntry({ ...retained.payload, party: "CX2-ZED", qty: 0.3,
      at: "2099-10-05T10:00:00.000Z" });
    const duplicateResult = await admitInputs(race.desk.SALT_LEDGER, [duplicate, duplicate], book, "device:fixture");
    ok(duplicateResult.accepted
        && duplicateResult.newSources.includes(duplicate.at)
        && race.sqlite.prepare("SELECT amount FROM input_admission WHERE id=?").get(duplicate.at)?.amount === 0.3
        && race.sqlite.prepare("SELECT COUNT(*) AS n FROM input_admission_source WHERE id=?").get(duplicate.at)?.n === 1,
      "an identical timestamp in a resource batch reserves its native amount once rather than counting a duplicate");
  } finally { race.source.w.close(); race.sqlite.close(); }
}
