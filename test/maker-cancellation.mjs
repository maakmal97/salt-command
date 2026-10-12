import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { webcrypto } from "node:crypto";
import { JSDOM } from "jsdom";
import desk from "../src/worker.js";
import { handleMaker } from "../stmt/maker.js";
import { landingPage } from "../stmt/page.js";
import { readBook } from "../tools/book.mjs";
import { buildSeed } from "../tools/d1.mjs";
import { tile, tileValue } from "./maker-act.mjs";

class Store {
  values = new Map();
  async get(key, type) { const v = this.values.get(key) ?? null; return v === null || type !== "json" ? v : JSON.parse(v); }
  async put(key, value) { this.values.set(key, value); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = "" } = {}) {
    return { keys: [...this.values.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
  }
}

export async function fixture() {
  const source = await readBook();
  const ledger = JSON.parse(JSON.stringify(source.ledger)), version = source.version;
  source.w.close();
  const customer = ledger.sales.find((row) => row.customer && row.date).customer;
  ledger.sales.push(
    { rid: "f18", date: "2026-08-30", customer, product: "salt", qty: 2, total: 450, cost: 64, cash: 450, deliveredQty: 0 },
    { rid: "f19", customer, product: "salt", qty: 1, total: 100, cost: 64, pending: true },
    { rid: "f20", date: "2026-08-30", customer, qty: 2, total: 450, cost: 64, cash: 50, settledRM: 100, deliveredQty: 0 },
    { rid: "f21", date: "2026-08-30", customer, qty: 2, total: 450, cost: 64, cash: 0, deliveredQty: 1 },
    { rid: "f22", date: "2026-08-30", customer, qty: 2, total: 450, cost: 64, cash: 0, deliveredQty: 0, defaulted: true },
    { rid: "f23", date: "2026-08-30", customer, qty: 2, total: 450, cost: 64, cash: 0, deliveredQty: 0, cancelled: true },
    { rid: "f25", date: "2026-08-30", customer, qty: 2, total: 450, cost: 64, cash: 450, deliveredQty: 0 }
  );
  ledger.purchases.push({ rid: "f24", date: "2026-08-30", supplier: ledger.purchases[0].supplier,
    qty: 2, total: 450, cash: 450, receivedQty: 0 });
  const db = new DatabaseSync(":memory:"), migrations = new URL("../migrations/", import.meta.url);
  for (const file of readdirSync(migrations).filter((f) => /^\d+_.*\.sql$/.test(f)).sort())
    db.exec(readFileSync(new URL(file, migrations), "utf8"));
  db.exec(buildSeed({ v: version, stamped: ledger.stamped || null, ledger }).sql);
  const D1 = {
    batch(statements) {
      db.exec("BEGIN IMMEDIATE");
      try { const out = statements.map((s) => s.run()); db.exec("COMMIT"); return out; }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    },
    prepare(sql) {
      const st = db.prepare(sql);
      const bind = (args) => ({
        run() { return { meta: { changes: Number(st.run(...args).changes || 0) } }; },
        first() { return st.get(...args) ?? null; },
        all() { return { results: st.all(...args) }; }
      });
      return { ...bind([]), bind: (...args) => bind(args) };
    }
  };
  const key = "cancellation-local-capability-0123456789";
  const deskEnv = { SALT_QUEUE: new Store(), SALT_LEDGER: D1, COUNTER_MAKER_KEY: key };
  const env = { STMT: new Store(), COUNTER_MAKER_KEY: key,
    DESK_MAKER: { fetch: (request) => desk.fetch(request, deskEnv, { waitUntil() {} }) } };
  const call = (path, init) => handleMaker(new Request("https://counter.test" + path, init), env, path,
    { email: "maakmal97@icloud.com" });
  const inputs = await call("/all/maker/inputs");
  if (!inputs.ok) throw new Error("Cancellation fixture catalog refused: " + await inputs.text());
  const context = await inputs.json();
  return { db, call, context, html: landingPage("", "cancellation-fixture", { master: "fixture-master", accounts: [] }) };
}

export async function run({ ok, pageWork }) {
  const f = await fixture(), posts = [], answers = [];
  let work;
  const browser = new JSDOM(f.html, {
    url: "https://counter.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(window) {
      Object.defineProperty(window, "crypto", { value: webcrypto });
      window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder;
      window.scrollTo = () => {};
      window.fetch = async (path, init) => {
        const route = String(path);
        if (route === "/all/maker/inputs" || route === "/all/maker/inputs/ledger-amend") {
          if (init?.method === "POST") posts.push(JSON.parse(init.body));
          const response = await f.call(route, init);
          if (init?.method === "POST") answers.push({ status: response.status, body: await response.clone().json() });
          return response;
        }
        return Response.json({ ok: true, accounts: [], orders: [], drafts: [], claims: [], threads: [],
          bulletin: { lines: [] }, config: null, status: {} });
      };
      work = pageWork(window);
    }
  });
  try {
    const window = browser.window, doc = window.document;
    const field = (root, name) => [...root.querySelectorAll("label")]
      .find((l) => l.querySelector(".lbl")?.textContent === name)?.querySelector("input,select");
    const editor = () => [...doc.querySelectorAll("#makerInputs .maker-input")]
      .find((s) => s.querySelector("h3")?.textContent === "Correct a row");
    const change = (node, value) => { node.value = value; node.dispatchEvent(new window.Event("change", { bubbles: true })); };
    doc.querySelector('[data-act="nav.record"]').click();
    if (!await work.quiet() || !editor()) throw new Error("Cancellation editor did not load.");
    const ed = editor(), row = field(ed, "Which row");
    const cash = field(ed, "RM"), units = field(ed, "Units");
    const preview = () => ed.querySelector(".maker-cancellation");
    const states = () => preview().querySelector(".maker-facts")?.textContent || "";
    const select = (rid) => { change(row, rid); tile(ed, "What to do", "Cancellation"); };
    select("f18");
    ok(cash.disabled, "v457.1a Counter Cancellation disables cash");
    ok(units.disabled, "v457.1b Counter Cancellation disables units");
    ok(cash.parentNode.parentNode.style.display === "none", "v457.1c Counter Cancellation hides movement fields");
    ok(/\bRefund due\b/.test(states()), "v457.2a paid cancellation preview reads Refund due");
    ok(/\bUndelivered\b/.test(states()), "v457.2b paid cancellation preview reads Undelivered");
    ok(/\bCancelled\b/.test(states()), "v457.2c paid cancellation preview reads Cancelled");
    ok(/RM 450[.]00 already paid becomes a refund you owe/.test(preview().textContent), "v457.2d paid cancellation discloses RM 450 refund payable");
    ok(/The order is cancelled/.test(preview().textContent), "v457.1d Counter Cancellation says figures are not used");
    select("f19");
    ok(/\bUnpaid\b/.test(states()), "v457.5a pending cancellation preview reads Unpaid");
    ok(/\bCancelled\b/.test(states()), "v457.5b pending cancellation preview reads Cancelled");
    ok(!/refund you owe/.test(preview().textContent), "v457.5c pending cancellation names no refund payable");
    select("f20");
    ok(/Refund due/.test(preview().textContent) && /RM 150[.]00 already paid becomes a refund you owe/.test(preview().textContent),
      "native cancellation disclosure includes value settled in kind, not total minus cash");
    select("f24");
    ok(/Refund due.*Undelivered.*Cancelled/.test(preview().textContent) && !/refund you owe/.test(preview().textContent),
      "native purchase cancellation states do not invent a customer refund payable");
    select("f21");
    ok(/This order cannot be cancelled/.test(preview().textContent) && !/After:/.test(preview().textContent),
      "goods already moved do not get a confident cancellation preview");
    change(row, "f22");
    ok(tileValue(ed, "What to do") === "Correction" && preview().hidden && !preview().textContent,
      "a defaulted row clears cancellation disclosure and remains Correction only");
    ok(![...row.options].some((o) => o.value === "f23"), "an already cancelled row is not offered for cancellation");
    select("f18");
    tile(ed, "What to do", "Fulfilment");
    ok(!cash.disabled && !units.disabled && preview().hidden && !preview().textContent,
      "leaving Cancellation restores movement controls and clears its disclosure");
    cash.value = "400"; units.value = "1";
    tile(ed, "What to do", "Cancellation");
    cash.disabled = false; units.disabled = false;
    [...ed.querySelectorAll("button")].find((b) => b.textContent === "Send the correction").click();
    if (!await work.quiet()) throw new Error("Cancellation submission did not settle.");
    const sent = posts[0] || {}, drafted = f.db.prepare("SELECT entry FROM draft WHERE id=?").get(sent.at);
    const entry = drafted ? JSON.parse(drafted.entry) : {}, payload = entry.payload || {};
    ok(posts.length === 1 && !Object.hasOwn(sent, "cash") && !Object.hasOwn(sent, "movedUnits") && !Object.hasOwn(sent, "fields"),
      "v457.3a actual Counter request omits stale RM 400, one unit and patch");
    ok(!!drafted && entry.status === "cancelled" && payload.kind === "Cancellation" && payload.rid === "f18",
      "v457.3b actual owner UI through Counter bridge and Worker drafts native Cancellation");
    ok(!!drafted && payload.cash === null, "v457.3c native cancellation payload cash is null");
    ok(!!drafted && payload.kg === null, "v457.3d native cancellation payload units are null");
    ok(!!drafted && payload.qty === null, "v457.3e native cancellation payload quantity is null");
    ok(!!drafted && payload.total === null, "v457.3f native cancellation payload total is null");
    ok(!!drafted && entry.qty === null, "v457.4a native cancellation top quantity is null");
    ok(!!drafted && entry.total === null, "v457.4b native cancellation top total is null");
    const staleEditor = editor();
    change(field(staleEditor, "Which row"), "f25");
    tile(staleEditor, "What to do", "Cancellation");
    const shown = staleEditor.querySelector(".maker-cancellation").textContent;
    const stored = f.db.prepare("SELECT seq,doc FROM entry WHERE collection='sales' AND json_extract(doc,'$.rid')='f25'").get();
    const moved = { ...JSON.parse(stored.doc), deliveredQty: 1 };
    f.db.prepare("UPDATE entry SET doc=? WHERE collection='sales' AND seq=?").run(JSON.stringify(moved), stored.seq);
    [...staleEditor.querySelectorAll("button")].find((b) => b.textContent === "Send the correction").click();
    if (!await work.quiet()) throw new Error("Stale cancellation refusal did not settle.");
    ok(/Refund due/.test(shown) && /RM 450[.]00 already paid becomes a refund you owe/.test(shown)
      && posts.length === 2 && posts[1].rid === "f25" && answers[1]?.status === 400
      && /cannot cancel goods already handed over/.test(answers[1]?.body.error || "")
      && /cannot cancel goods already handed over/.test(staleEditor.querySelector('[role="status"]').textContent)
      && f.db.prepare("SELECT count(*) AS n FROM draft").get().n === 1,
    "stale seeded refund disclosure authorizes nothing: actual UI send re-reads moved row, explicitly refuses, drafts nothing");
  } finally { browser.window.close(); f.db.close(); }
}
