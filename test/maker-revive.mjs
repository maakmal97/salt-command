/* test/maker-revive.mjs: Counter Admin revives a cancelled order. A cancelled row takes one Correction, cancelled off and its date
   cleared together, and only while nothing is paid against it and nothing has moved: a paid cancel raised a refund, and a revival
   would count the money twice. The proposal is the Desk's own ledgerAmendmentEntry, drafted by the native drafter over the real
   bridge and mirror; the owner page keeps one request id until it lands. Notes and settlement prose stay on the Desk. */
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { webcrypto } from "node:crypto";
import { JSDOM } from "jsdom";
import desk from "../src/worker.js";
import { handleMaker } from "../stmt/maker.js";
import { landingPage } from "../stmt/page.js";
import { makerInputCatalog, makerLedgerAmendment } from "../src/maker-inputs.js";
import { reviving, draftRow } from "../src/drafter.js";
import { readBook } from "../tools/book.mjs";
import { buildSeed } from "../tools/d1.mjs";
class Store {
  values = new Map();
  async get(key, type) { const v = this.values.get(key) ?? null; return v === null || type !== "json" ? v : JSON.parse(v); }
  async put(key, value) { this.values.set(key, value); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = "" } = {}) {
    return { keys: [...this.values.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
  }
}

const sale = (rid, date, more = {}) => ({ rid, customer: "CM4-TO", date, qty: 1, total: 110, cost: 48, cash: 0,
  handover: "collected", delivery: 0, ...more });
const SCENARIO = [
  sale("rv-open", "2026-10-01"),
  sale("rv-cancel", "2026-09-03", { cancelled: true, cancelledOn: "2026-09-04" }),
  sale("rv-paid", "2026-09-05", { cancelled: true, cancelledOn: "2026-09-06", cash: 50 }),
  sale("rv-moved", "2026-09-07", { cancelled: true, cancelledOn: "2026-09-08", deliveredQty: 1, handover: "collected" })
];
const REVIVE = { cancelled: false, cancelledOn: null };

export async function run({ ok }) {
  const source = await readBook();
  const { w, version } = source;
  const ledger = JSON.parse(JSON.stringify(source.ledger));
  try {
    const copy = JSON.parse(JSON.stringify(ledger));
    copy.sales = copy.sales.concat(JSON.parse(JSON.stringify(SCENARIO)));
    const book = { sales: copy.sales, purchases: copy.purchases, state: copy, version, pricing: copy.PRICING };
    const today = w.eval("TODAY.toISOString().slice(0,10)");
    const amend = (rid, kind, extra = {}, at = "2026-10-06T01:00:00.000Z") =>
      makerLedgerAmendment({ at, rid, kind, date: today, ...extra }, book);

    /* the shape of a revival */
    ok(reviving(REVIVE) && !reviving({ cancelled: false }) && !reviving({ cancelledOn: null })
      && !reviving({ ...REVIVE, orderCode: "E1" }) && !reviving({ cancelled: true, cancelledOn: null })
      && !reviving({ cancelled: false, cancelledOn: "2026-09-04" }) && !reviving(null),
      "a revival is cancelled off and its date cleared, together and alone");

    /* the catalog lists what could be revived, with what is paid and moved, so the page can offer only the clean ones */
    const catalog = makerInputCatalog(book), listed = (rid) => (catalog.revivable || []).find((r) => r.rid === rid);
    ok(listed("rv-cancel") && listed("rv-cancel").paid === 0 && listed("rv-cancel").movedUnits === 0
      && listed("rv-paid") && listed("rv-paid").paid === 50 && listed("rv-moved") && listed("rv-moved").movedUnits === 1
      && !listed("rv-open") && !catalog.rows.some((r) => r.rid === "rv-cancel"),
      "the catalog lists the cancelled rows with what is paid and moved, never an open row, and the editor still omits them: "
      + JSON.stringify(catalog.revivable.filter((r) => r.rid.startsWith("rv-"))));

    /* a clean revival is the Desk's own amendment entry, and the drafter says what it does */
    const clean = amend("rv-cancel", "Correction", { fields: REVIVE });
    const row = book.sales.find((r) => r.rid === "rv-cancel");
    const deskEntry = JSON.parse(w.eval(`JSON.stringify(POSITION_ENGINE.ledgerAmendmentEntry({at:"2026-10-06T01:00:00.000Z",
      row:${JSON.stringify(row)},direction:"SELL",kind:"Correction",date:${JSON.stringify(today)},fields:{cancelled:false,cancelledOn:null}}))`));
    ok(clean.entry && clean.draft && !clean.draft.skip && JSON.stringify(clean.entry.payload) === JSON.stringify(deskEntry.payload),
      "a revival is the Desk's own amendment entry, drafted without refusal: " + JSON.stringify(clean.error || clean.entry && clean.entry.payload));
    ok(clean.draft && (clean.draft.flags || []).some((f) => /^Revives a cancelled order: 1 unit for RM 110 is on the book again/.test(f)),
      "the approver's card says it revives an order: " + JSON.stringify(clean.draft && clean.draft.flags));

    /* what a revival may not be */
    const paid = amend("rv-paid", "Correction", { fields: REVIVE }), moved = amend("rv-moved", "Correction", { fields: REVIVE });
    ok(/RM 50 paid against it, which is a refund owed/.test(paid.error || "") && !paid.entry,
      "a cancelled row with money paid is refused, the drafter's own rule: " + JSON.stringify(paid.error));
    ok(/1 unit already moved/.test(moved.error || "") && !moved.entry,
      "a cancelled row with goods moved is refused: " + JSON.stringify(moved.error));
    const loose = [{ cancelled: false }, { cancelledOn: null }, { ...REVIVE, orderCode: "E9" }, { orderCode: "E9" }, { cancelled: true, cancelledOn: null }]
      .map((fields) => amend("rv-cancel", "Correction", { fields }));
    ok(loose.every((r) => /takes only its revival/.test(r.error || "") && !r.entry),
      "any other correction on a cancelled row is still refused: " + JSON.stringify(loose.map((r) => r.error)));
    const kinds = [["Fulfilment", { cash: 10, movedUnits: 0 }], ["Cancellation", {}]].map(([kind, extra]) => amend("rv-cancel", kind, extra));
    ok(kinds.every((r) => /takes only its revival/.test(r.error || "") && !r.entry),
      "no movement reaches a cancelled row: " + JSON.stringify(kinds.map((r) => r.error)));
    const direct = draftRow({ ...clean.entry, payload: { ...clean.entry.payload, fields: { orderCode: "E9" } } }, book);
    ok(!!direct.skip && /cancelled/.test(direct.skip), "the drafter itself skips any correction but a revival on a cancelled row, whatever reaches it: " + JSON.stringify(direct.skip));
    const notCancelled = amend("rv-open", "Correction", { fields: REVIVE });
    ok(!!notCancelled.error && !notCancelled.entry,
      "an order that is not cancelled has nothing to revive: " + JSON.stringify(notCancelled.error));
    const prose = amend("rv-cancel", "Correction", { fields: { ...REVIVE, note: "back on" } });
    ok(/takes only its revival/.test(prose.error || "") && !prose.entry, "prose never rides on a revival: " + JSON.stringify(prose.error));

    /* the retained request may carry it */
    const kept = POSITION_ENGINE_OK(w, { path: "/all/maker/inputs/ledger-amend",
      body: { at: "2026-10-06T01:00:00.000Z", rid: "rv-cancel", kind: "Correction", date: today, fields: REVIVE } });
    ok(kept, "a retained revival request is admitted by the device's retained-input check");

    /* the road: the verified owner, the bridge, the mirror, the drafter, once */
    const migrations = new URL("../migrations/", import.meta.url), db = new DatabaseSync(":memory:");
    for (const f of readdirSync(migrations).filter((x) => /^\d+_.*\.sql$/.test(x)).sort())
      db.exec(readFileSync(new URL(f, migrations), "utf8"));
    const live = JSON.parse(JSON.stringify(ledger)); live.sales = live.sales.concat(JSON.parse(JSON.stringify(SCENARIO)));
    db.exec(buildSeed({ v: version, stamped: ledger.stamped || null, ledger: live }).sql);
    const D1 = { batch(statements) {
      db.exec("BEGIN IMMEDIATE");
      try { const out = statements.map((s) => s.run()); db.exec("COMMIT"); return out; } catch (e) { db.exec("ROLLBACK"); throw e; }
    }, prepare(sql) {
      const st = db.prepare(sql);
      const mk = (a) => ({ run() { return { meta: { changes: Number(st.run(...a).changes || 0) } }; },
        first() { const r = st.get(...a); return r === undefined ? null : r; }, all() { return { results: st.all(...a) }; } });
      const self = mk([]); self.bind = (...a) => mk(a); return self;
    } };
    const makerKey = "maker-revive-local-capability-0123456789";
    const deskEnv = { SALT_QUEUE: new Store(), SALT_LEDGER: D1, COUNTER_MAKER_KEY: makerKey };
    const counterEnv = { STMT: new Store(), COUNTER_MAKER_KEY: makerKey,
      DESK_MAKER: { fetch: (request) => desk.fetch(request, deskEnv, { waitUntil() {} }) } };
    const call = (body, identity = { email: "maakmal97@icloud.com" }) => handleMaker(new Request("https://counter.test/all/maker/inputs/ledger-amend",
      { method: "POST", body: JSON.stringify(body) }), counterEnv, "/all/maker/inputs/ledger-amend", identity);
    const drafts = () => db.prepare("SELECT id,status,entry FROM draft ORDER BY id").all();
    const tap = { at: "2026-10-06T02:00:00.000Z", rid: "rv-cancel", kind: "Correction", date: today, fields: REVIVE };
    const other = await call(tap, { email: "other@example.test" });
    const first = await call(tap), firstBody = await first.json();
    const landed = drafts();
    ok(other.status === 403 && first.status === 200 && firstBody.ok && landed.length === 1 && landed[0].id === tap.at
      && JSON.parse(landed[0].entry).payload.rid === "rv-cancel"
      && JSON.stringify(JSON.parse(landed[0].entry).payload.fields) === JSON.stringify(REVIVE),
      "the owner's revival reaches the drafter once, another identity nothing: " + other.status + " " + first.status + " " + JSON.stringify(firstBody));
    const retry = await call(tap);
    ok(retry.status === 200 && drafts().length === 1, "the same request id again is answered from its receipt and drafts nothing more: " + retry.status);
    const refused = await call({ ...tap, at: "2026-10-06T02:01:00.000Z", rid: "rv-paid" }), refusedBody = await refused.json();
    ok(refused.status === 400 && /refund owed/.test(refusedBody.error) && drafts().length === 1,
      "a paid cancelled row is refused on the road, and nothing is drafted: " + refused.status + " " + JSON.stringify(refusedBody));
  } finally { w.close(); }

  /* ---- the owner page's section, in the actual owner script ---- */
  const posts = [];
  let failNext = 0;
  const catalog = { parties: [], loans: [], rewards: [], tierCustomers: [], correctionFields: [{ field: "qty", kind: "number", required: true }],
    rows: [], revivable: [
      { rid: "rv-a", direction: "SELL", party: "CM4-TO", product: "salt", date: "2026-09-03", cancelledOn: "2026-09-04", qty: 1, total: 110, paid: 0, movedUnits: 0 },
      { rid: "rv-b", direction: "SELL", party: "CM4-TO", product: "salt", date: "2026-09-05", cancelledOn: "2026-09-06", qty: 1, total: 110, paid: 50, movedUnits: 0 },
      { rid: "rv-c", direction: "SELL", party: "CM4-TO", product: "salt", date: "2026-09-07", cancelledOn: "2026-09-08", qty: 1, total: 110, paid: 0, movedUnits: 1 }] };
  const browser = new JSDOM(landingPage("", "fixture", { master: "local-master", accounts: [] }), {
    url: "https://counter.fixture.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(window) {
      Object.defineProperty(window, "crypto", { value: { getRandomValues: (a) => webcrypto.getRandomValues(a), randomUUID: () => webcrypto.randomUUID(), subtle: webcrypto.subtle } });
      window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder;
      window.scrollTo = () => {}; window.confirm = () => true;
      window.fetch = async (path, init) => {
        const where = String(path);
        if (init && init.method === "POST" && where === "/all/maker/inputs/ledger-amend") {
          posts.push(JSON.parse(init.body));
          if (failNext > 0) { failNext--; return Response.json({ ok: false, error: "The Desk did not answer." }, { status: 503 }); }
          return Response.json({ ok: true });
        }
        if (where === "/all/maker/review") return Response.json({ ok: true, drafts: [], orders: [] });
        if (where === "/all/maker/claims") return Response.json({ ok: true, claims: [] });
        if (where === "/all/maker/threads") return Response.json({ ok: true, threads: [] });
        if (where === "/all/maker/bulletin") return Response.json({ ok: true, bulletin: { lines: [] } });
        if (where === "/all/maker/inputs") return Response.json({ ok: true, products: ["salt"], catalog });
        if (where === "/all/maker/hours") return Response.json({ ok: true, config: null, status: {} });
        return Response.json({ ok: true, accounts: [] });
      };
    }
  });
  try {
    const window = browser.window, doc = window.document;
    const until = async (predicate) => {
      for (let i = 0; i < 200 && !predicate(); i++) await new Promise((resolve) => setTimeout(resolve, 10));
      return !!predicate();
    };
    const pause = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));
    const section = () => [...doc.querySelectorAll("#makerInputs .maker-input")].find((s) => s.querySelector("h3").textContent === "Revive a cancelled row");
    const press = (root, text) => [...root.querySelectorAll("button")].find((b) => b.textContent === text).click();
    doc.querySelector('[data-m="maker"]').click();
    await until(() => section());
    const sec = section(), select = sec.querySelector("select");
    ok(select && [...select.options].map((o) => o.value).join(",") === "rv-a",
      "the page offers only the cancelled rows with nothing paid and nothing moved: " + (select && [...select.options].map((o) => o.value).join(",")));
    failNext = 1;
    press(sec, "Send revival for review");
    await until(() => posts.length >= 1); await pause();
    press(sec, "Send revival for review");
    await until(() => posts.length >= 2); await pause();
    const [sent, resent] = [posts[0] || {}, posts[1] || {}];
    ok(sent.kind === "Correction" && sent.rid === "rv-a" && JSON.stringify(sent.fields) === JSON.stringify(REVIVE)
      && typeof sent.at === "string" && resent.at === sent.at && JSON.stringify(resent.fields) === JSON.stringify(REVIVE),
      "the revival is sent as the one Correction, and the retry after a failure carries the same request id: " + JSON.stringify(posts.slice(0, 2)));
  } finally { browser.window.close(); }
}

function POSITION_ENGINE_OK(w, record) {
  return !!w.eval(`POSITION_ENGINE.vaultPendingOk(${JSON.stringify(record)})`);
}