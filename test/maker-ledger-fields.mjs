/* test/maker-ledger-fields.mjs: the ledger fields Salt Admin may now correct. A Correction sets or clears the order code, which
   is code-shaped and passes siteWords; a defaulted row is listed and takes a Correction only; a cancelled row is never listed in the editor and takes only its revival (test/maker-revive.mjs); notes and settlement prose stay on the Desk. Each proposal is the Desk's own
   ledgerAmendmentEntry, drafted by the native drafter over the real bridge and mirror; the owner page keeps one request id per
   amendment until it lands. */
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { webcrypto } from "node:crypto";
import { JSDOM } from "jsdom";
import desk from "../src/worker.js";
import { handleMaker } from "../stmt/maker.js";
import { landingPage } from "../stmt/page.js";
import { makerInputCatalog, makerLedgerAmendment } from "../src/maker-inputs.js";
import { readBook } from "../tools/book.mjs";
import POSITION_ENGINE from "../engine/position.mjs";
import { buildSeed } from "../tools/d1.mjs";
import { tileValues } from "./maker-act.mjs";

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
  sale("lf-open", "2026-10-01"),
  sale("lf-default", "2026-09-02", { defaulted: true, defaultedOn: "2026-09-30" }),
  sale("lf-cancel", "2026-09-03", { cancelled: true, cancelledOn: "2026-09-04" })
];

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

    /* the catalog */
    const catalog = makerInputCatalog(book), fields = catalog.correctionFields.map((f) => f.field);
    const codeField = catalog.correctionFields.find((f) => f.field === "orderCode");
    ok(codeField && codeField.kind === "text" && !codeField.required && !fields.includes("note") && !fields.includes("settle"),
      "the order code is offered as a text field, notes and settlement prose are not: " + JSON.stringify(codeField) + " " + fields.join(","));
    const listed = (rid) => catalog.rows.find((r) => r.rid === rid);
    ok(listed("lf-default") && listed("lf-default").defaulted === true && listed("lf-open") && !listed("lf-open").defaulted
      && !listed("lf-cancel"),
      "a defaulted row is listed and marked, a cancelled row is not listed: " + JSON.stringify([listed("lf-default"), listed("lf-cancel")]));

    /* the order code, through the Desk's own amendment entry and the drafter */
    const set = amend("lf-open", "Correction", { fields: { orderCode: "E222" } });
    const row = book.sales.find((r) => r.rid === "lf-open");
    const deskEntry = JSON.parse(w.eval(`JSON.stringify(POSITION_ENGINE.ledgerAmendmentEntry({at:"2026-10-06T01:00:00.000Z",
      row:${JSON.stringify(row)},direction:"SELL",kind:"Correction",date:${JSON.stringify(today)},fields:{orderCode:"E222"}}))`));
    ok(set.entry && set.draft && !set.draft.skip && JSON.stringify(set.entry.payload) === JSON.stringify(deskEntry.payload),
      "an order code Correction is the Desk's own amendment entry, drafted without refusal: " + JSON.stringify(set.error || set.entry && set.entry.payload));
    const cleared = amend("lf-open", "Correction", { fields: { orderCode: null } });
    ok(!!cleared.error === !row.orderCode,
      "clearing an order code the row does not carry changes nothing and is refused, by the drafter's own rule: " + JSON.stringify(cleared.error));
    const words = ["CM4-TO", "Gold", "titanium"].map((value) => amend("lf-open", "Correction", { fields: { orderCode: value } }));
    ok(words.every((r) => /^Not sent: that (carries a roster code|names a level)/.test(r.error || "") && !r.entry),
      "an order code holding a roster code or a level's name is stopped by siteWords: " + JSON.stringify(words.map((r) => r.error)));
    const shapes = ["E 1", "", "E111-and-far-too-long", "-E1", 12, "E1/2"].map((value) => amend("lf-open", "Correction", { fields: { orderCode: value } }));
    ok(shapes.every((r) => /up to 16 letters, digits and hyphens/.test(r.error || "") && !r.entry),
      "an order code is letters, digits and hyphens, up to 16: " + JSON.stringify(shapes.map((r) => r.error)));
    const prose = ["note", "settle"].map((field) => amend("lf-open", "Correction", { fields: { [field]: "a line" } }));
    ok(prose.every((r) => /notes and settlement prose stay on Desk/.test(r.error || "")),
      "a note or settlement prose is still refused: " + JSON.stringify(prose.map((r) => r.error)));

    /* a defaulted row takes a Correction, and only that */
    const fixDefault = amend("lf-default", "Correction", { fields: { orderCode: "E223" } });
    ok(fixDefault.entry && fixDefault.draft && !fixDefault.draft.skip && fixDefault.entry.payload.rid === "lf-default"
      && JSON.stringify(fixDefault.entry.payload.fields) === JSON.stringify({ orderCode: "E223" }),
      "a defaulted row takes an order code Correction, drafted without refusal: " + JSON.stringify(fixDefault.error || ""));
    const moves = [["Fulfilment", { cash: 10, movedUnits: 0 }], ["Cancellation", {}]].map(([kind, extra]) => amend("lf-default", kind, extra));
    ok(moves.every((r) => r.error === "A defaulted row takes a Correction only." && !r.entry),
      "a defaulted row takes no Fulfilment or Cancellation from Salt Admin: " + JSON.stringify(moves.map((r) => r.error)));

    /* a cancelled row: only its revival reaches it */
    const revive = [["Correction", { fields: { orderCode: "E224" } }], ["Correction", { fields: { cancelled: false } }],
      ["Fulfilment", { cash: 10, movedUnits: 0 }]].map(([kind, extra]) => amend("lf-cancel", kind, extra));
    ok(revive.every((r) => r.error === "A cancelled row takes only its revival: cancelled off and its date cleared." && !r.entry),
      "no other correction or movement reaches a cancelled row from Salt Admin: " + JSON.stringify(revive.map((r) => r.error)));

    /* the page keeps a request it could not send on the device; an order code is a retainable value, prose is not */
    const kept = (value) => POSITION_ENGINE.vaultPendingOk({ path: "/all/maker/inputs/ledger-amend",
      body: { at: "2026-10-06T01:00:00.000Z", rid: "lf-open", kind: "Correction", date: today, fields: { orderCode: value } } });
    ok(kept("E222") && kept("e-12") && kept(null) && !kept("a line of words") && !kept("E1/2") && !kept("x".repeat(17)),
      "a retained ledger amendment may carry an order code, never free text: "
      + JSON.stringify(["E222", "e-12", null, "a line of words", "E1/2", "x".repeat(17)].map(kept)));

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
    const makerKey = "maker-fields-local-capability-0123456789";
    const deskEnv = { SALT_QUEUE: new Store(), SALT_LEDGER: D1, COUNTER_MAKER_KEY: makerKey };
    const counterEnv = { STMT: new Store(), COUNTER_MAKER_KEY: makerKey,
      DESK_MAKER: { fetch: (request) => desk.fetch(request, deskEnv, { waitUntil() {} }) } };
    const call = (body, identity = { email: "maakmal97@icloud.com" }) => handleMaker(new Request("https://counter.test/all/maker/inputs/ledger-amend",
      { method: "POST", body: JSON.stringify(body) }), counterEnv, "/all/maker/inputs/ledger-amend", identity);
    const drafts = () => db.prepare("SELECT id,status,entry FROM draft ORDER BY id").all();
    const tap = { at: "2026-10-06T02:00:00.000Z", rid: "lf-default", kind: "Correction", date: today, fields: { orderCode: "E225" } };
    const other = await call(tap, { email: "other@example.test" });
    const first = await call(tap), firstBody = await first.json();
    const landed = drafts();
    ok(other.status === 403 && first.status === 200 && firstBody.ok && landed.length === 1 && landed[0].id === tap.at
      && JSON.parse(landed[0].entry).payload.fields.orderCode === "E225" && JSON.parse(landed[0].entry).payload.rid === "lf-default",
      "the owner's order code Correction on a defaulted row reaches the drafter once, another identity nothing: "
      + other.status + " " + first.status + " " + JSON.stringify(firstBody));
    const retry = await call(tap);
    ok(retry.status === 200 && drafts().length === 1, "the same request id again is answered from its receipt and drafts nothing more: " + retry.status);
    const refused = await call({ ...tap, at: "2026-10-06T02:01:00.000Z", rid: "lf-cancel" }), refusedBody = await refused.json();
    ok(refused.status === 400 && /takes only its revival/.test(refusedBody.error) && drafts().length === 1,
      "a cancelled row is refused on the road, and nothing is drafted: " + refused.status + " " + JSON.stringify(refusedBody));
  } finally { w.close(); }

  /* ---- the owner page's editor, in the actual owner script ---- */
  const posts = [];
  let failNext = 0;
  const catalog = { parties: [], loans: [], rewards: [], tierCustomers: [],
    correctionFields: [{ field: "qty", kind: "number", required: true }, { field: "orderCode", kind: "text", required: false }],
    rows: [{ rid: "row-open-0001", direction: "BUY", party: "SP1-AB", product: "salt", date: "2026-10-01", qty: 10, total: 500 },
      { rid: "row-default-01", direction: "BUY", party: "SP1-AB", product: "salt", date: "2026-09-01", qty: 4, total: 200, defaulted: true }] };
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
    const fieldIn = (root, label) => {
      const wrap = root && [...root.querySelectorAll("label")].find((l) => l.querySelector(".lbl") && l.querySelector(".lbl").textContent === label);
      return wrap && wrap.querySelector("input, select");
    };
    const editor = () => [...doc.querySelectorAll("#makerInputs .maker-input")].find((s) => s.querySelector("h3").textContent === "Correct a row");
    const press = (root, text) => [...root.querySelectorAll("button")].find((b) => b.textContent === text).click();
    const change = (node, value) => { node.value = value; node.dispatchEvent(new window.Event("change", { bubbles: true })); };
    doc.querySelector('[data-act="nav.record"]').click();
    await until(() => editor());
    const ed = editor(), rowSel = fieldIn(ed, "Which row");
    const kinds = () => tileValues(ed, "What to do").join(",");
    change(rowSel, "row-default-01");
    const defaultKinds = kinds(), defaultLabel = rowSel.options[rowSel.selectedIndex].textContent;
    change(rowSel, "row-open-0001");
    ok(defaultKinds === "Correction" && /, defaulted$/.test(defaultLabel) && kinds().split(",").length === 6,
      "a defaulted row is marked and offers a Correction only; an open lot keeps its kinds: " + defaultKinds + " / " + defaultLabel + " / " + kinds());

    change(fieldIn(ed, "What to change"), "orderCode");
    const valueBox = fieldIn(ed, "New value");
    ok(valueBox && valueBox.tagName === "INPUT" && valueBox.type === "text",
      "the order code is typed into a text box: " + (valueBox && valueBox.tagName + "/" + valueBox.type));
    valueBox.value = "  E226 ";
    press(ed, "Add");
    failNext = 1;
    press(ed, "Send the correction");
    await until(() => posts.length >= 1); await pause();
    press(ed, "Send the correction");
    await until(() => posts.length >= 2); await pause();
    const [sent, resent] = [posts[0] || {}, posts[1] || {}];
    ok(sent.kind === "Correction" && sent.rid === "row-open-0001" && JSON.stringify(sent.fields) === JSON.stringify({ orderCode: "E226" })
      && typeof sent.at === "string" && resent.at === sent.at && JSON.stringify(resent.fields) === JSON.stringify(sent.fields),
      "the order code is sent trimmed, and the retry after a failure carries the same request id: " + JSON.stringify(posts.slice(0, 2)));
    await until(() => editor() && editor() !== ed); await pause();
    const ed2 = editor();
    change(fieldIn(ed2, "What to change"), "orderCode");
    fieldIn(ed2, "New value").value = "E226";
    press(ed2, "Add");
    press(ed2, "Send the correction");
    await until(() => posts.length >= 3); await pause();
    ok(!!posts[2] && posts[2].at !== sent.at && JSON.stringify(posts[2].fields) === JSON.stringify({ orderCode: "E226" }),
      "once an amendment has landed, the same change sent again is a new request: " + JSON.stringify(posts[2]));
  } finally { browser.window.close(); }
}
