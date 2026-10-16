/* Counter Admin's mini ledger, the Desk half and the road to it (16 Oct 2026). makerLedgerMini reads the folded book by the engine's own rules and
   states none: Open is the order words that begin Open (Advance and Deferred too), Pending the word Pending, the latest twenty by date then order id
   newest first. The expected lists below are written out by hand from each row's money and goods, never computed by the code under test. The road is the
   verified owner through the bridge, to the Desk's private route that answers only its capability, by GET alone. */
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import desk from "../src/worker.js";
import { handleMaker } from "../stmt/maker.js";
import { makerLedgerMini } from "../src/maker-inputs.js";
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

const row = (rid, customer, date, qty, total, more = {}) => ({ rid, customer, date, qty, total, cost: 48, cash: 0, delivery: 0, deliveredQty: 0, ...more });
/* every state, in the year 2027 so that these rows are the newest of any book they are laid over */
export const SCENARIO = [
  row("lm1", "CA1-AAA", "2027-01-01", 2, 200),                                                                  /* nothing paid, nothing moved: Pending */
  row("lm2", "CA1-BBB", "2027-01-02", 1, 50, { product: "oil", deliveredQty: 1 }),                              /* goods out, nothing in: Open · Advance, RM 50 owed */
  row("lm3", "CA1-CCC", "2027-01-03", 4, 80, { product: "candy", cash: 80 }),                                   /* paid, nothing out: Open · Deferred */
  row("lm4", "CA1-DDD", "2027-01-04", 1, 30, { product: "rice", cash: 30, deliveredQty: 1 }),                   /* Completed */
  row("lm5", "CA1-AAA", "2027-01-05", 1, 100, { cancelled: true }),                                             /* Cancelled */
  row("lm6", "CA1-BBB", "2027-01-05", 2, 200, { cash: 100, deliveredQty: 1, delivery: 10 }),                    /* RM 210 owed less 100 paid; one unit out, RM 5 of it unpaid */
  row("lm7", "CA1-CCC", "2027-01-06", 1, 100, { defaulted: true, deliveredQty: 1 }),                            /* written off: Default, owed nothing */
  row("lm9", "CA1-DDD", "2027-01-07", 1, 100),
  row("lm10", "CA1-DDD", "2027-01-07", 1, 100)                                                                   /* the same day as lm9: the higher number is newer */
];
const FILLER = Array.from({ length: 20 }, (_, i) => row("lf" + String(i + 1).padStart(2, "0"), "CA1-EEE", "2026-12-" + String(i + 1).padStart(2, "0"), 1, 10, { cash: 10, deliveredQty: 1 }));
const ids = (list) => list.map((r) => r.rid).join();

export async function run({ ok }) {
  const book = (sales) => ({ sales, purchases: [], state: {}, version: 7 });
  const pure = makerLedgerMini(book([...FILLER, ...SCENARIO.slice().reverse()]));
  const by = Object.fromEntries(pure.recent.concat(pure.open, pure.pending).map((r) => [r.rid, r]));

  ok(ids(pure.open) === "lm6,lm3,lm2" && by.lm2.stage === "Open · Advance" && by.lm3.stage === "Open · Deferred" && by.lm6.stage === "Open · Advance",
    "Open is every order word that begins Open, Advance and Deferred both, newest first: " + ids(pure.open));
  ok(ids(pure.pending) === "lm10,lm9,lm1", "Pending is the orders with nothing paid and nothing moved, newest first, the higher order number first on one day: " + ids(pure.pending));
  ok(pure.recent.length === 20 && ids(pure.recent).startsWith("lm10,lm9,lm7,lm6,lm5,lm4,lm3,lm2,lm1,lf20,lf19") && pure.recent[19].rid === "lf10" && pure.orders === 29,
    "the latest are twenty, by date then order id, newest first, of every book: " + ids(pure.recent));
  ok(by.lm4.stage === "Completed" && by.lm5.stage === "Cancelled" && by.lm7.stage === "Default"
    && ![...pure.open, ...pure.pending].some((r) => ["lm4", "lm5", "lm7"].includes(r.rid)),
  "a completed, a cancelled and a defaulted order are in neither Open nor Pending: " + [by.lm4.stage, by.lm5.stage, by.lm7.stage]);
  ok(by.lm2.owed === 50 && by.lm2.advance === 50 && by.lm3.owed === 0 && by.lm6.owed === 110 && by.lm6.advance === 5 && by.lm5.owed === 0 && by.lm7.owed === 0 && by.lm7.advance === 0,
    "owed is what is still to come in (goods and delivery less paid), the advance the goods out unpaid, and a cancelled or written-off order owes nothing: "
    + JSON.stringify([by.lm2, by.lm3, by.lm6, by.lm5, by.lm7].map((r) => [r.rid, r.owed, r.advance])));
  ok(by.lm6.moved === 1 && by.lm6.qty === 2 && by.lm3.moved === 0 && by.lm3.qty === 4 && by.lm2.product === "oil" && by.lm3.product === "candy" && by.lm4.product === "rice" && by.lm1.product === "salt"
    && by.lm1.customer === "CA1-AAA" && by.lm1.date === "2027-01-01" && by.lm6.total === 200,
  "a row carries its code, date, book, units, total and what was handed over of what was ordered");
  ok(makerLedgerMini(book(SCENARIO), 3).recent.length === 3
    && ids(makerLedgerMini(book([row("n1", "CA1-AAA", null, 1, 10), row("d1", "CA1-AAA", "2026-01-01", 1, 10), row("", "CA1-AAA", "2027-02-01", 1, 10)])).recent) === "d1,n1"
    && !!makerLedgerMini({ sales: [], state: {} }).error,
  "a row with no date comes last, a row with no id is not an order, and an unseeded mirror is an error and not an empty list");

  /* the road */
  const source = await readBook();
  const { w, version } = source;
  const ledger = JSON.parse(JSON.stringify(source.ledger));
  try {
    const live = JSON.parse(JSON.stringify(ledger)); live.sales = live.sales.concat(JSON.parse(JSON.stringify(SCENARIO)));
    const migrations = new URL("../migrations/", import.meta.url), db = new DatabaseSync(":memory:");
    for (const f of readdirSync(migrations).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(new URL(f, migrations), "utf8"));
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
    const makerKey = "maker-ledger-local-capability-0123456789";
    const deskEnv = { SALT_QUEUE: new Store(), SALT_LEDGER: D1, COUNTER_MAKER_KEY: makerKey };
    const counterEnv = { STMT: new Store(), COUNTER_MAKER_KEY: makerKey,
      DESK_MAKER: { fetch: (request) => desk.fetch(request, deskEnv, { waitUntil() {} }) } };
    const call = (path, init, identity = { email: "maakmal97@icloud.com" }) => handleMaker(new Request("https://counter.test" + path, init || {}), counterEnv, path, identity);

    const read = await call("/all/maker/ledger"), body = await read.json();
    const got = Object.fromEntries((body.recent || []).concat(body.open || [], body.pending || []).map((r) => [r.rid, r.stage]));
    ok(read.status === 200 && body.ok === true && ids(body.recent || []).startsWith("lm10,lm9,lm7,lm6,lm5,lm4,lm3,lm2,lm1") && body.recent.length === 20
      && ids(body.open.filter((r) => r.rid.startsWith("lm"))) === "lm6,lm3,lm2" && ids(body.pending.filter((r) => r.rid.startsWith("lm"))) === "lm10,lm9,lm1"
      && got.lm2 === "Open · Advance" && got.lm4 === "Completed",
    "the owner's read reaches the Desk's mirror and answers the three lists: " + read.status + " " + JSON.stringify(body).slice(0, 200));
    ok(body.open.every((r) => r.stage.startsWith("Open")) && body.pending.every((r) => r.stage === "Pending") && body.orders === live.sales.filter((s) => s.rid && s.customer).length,
      "over the whole book every Open row reads Open and every Pending row Pending, and the count is every order on it");
    ok((await call("/all/maker/ledger", {}, { email: "other@example.test" })).status === 403,
      "another identity is refused the ledger");
    ok((await call("/all/maker/ledger", { method: "POST", body: "{}" })).status === 405, "the ledger is read by GET alone");
    const wrong = await desk.fetch(new Request("https://desk.test/_internal/maker/ledger", { headers: { "X-Counter-Maker-Key": "x".repeat(40) } }), deskEnv, { waitUntil() {} });
    const bare = await desk.fetch(new Request("https://desk.test/_internal/maker/ledger"), deskEnv, { waitUntil() {} });
    ok(wrong.status === 404 && bare.status === 404, "the Desk's end of the bridge answers the ledger only to its capability");
  } finally { w.close(); }
}
