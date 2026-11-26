import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { draftRow, dryRunDrafter, runDrafter } from "../src/drafter.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lotAt = "2026-10-10T01:00:00.000Z";
const saleAt = "2026-10-10T01:01:00.000Z";
const buy = { at: lotAt, payload: { mode: "new", direction: "BUY", party: "SZ1-FOX", product: "candy",
  qty: 1, total: 60, cash: 60, kg: 1, date: "2026-10-10" } };
const sell = { at: saleAt, payload: { mode: "new", direction: "SELL", party: "CZ1-ZED", product: "candy",
  qty: 1, total: 100, cash: 100, kg: 1, date: "2026-10-10" } };

async function exercise(when, { winnerTotal = 60, editedTotal = null, rejectWinner = false, dry = false, failRead = false } = {}) {
  const book = { version: "vQ", pricing: { v: "vQ", byProduct: { candy: { stockCost: 20, replCost: 20, floors: { "1": { floor: 20 } } } } },
    purchases: [{ rid: "pA", product: "candy", supplier: "SZ1-FOX", date: "2026-10-01", receivedOn: "2026-10-01",
      qty: 20, receivedQty: 20, total: 400, cash: 400, status: "paid" }],
    sales: [], state: { roster: ["SZ1-FOX", "CZ1-ZED"], QUEUE_COMMITTED: "2026-10-01T00:00:00.000Z" } };
  const db = new DatabaseSync(":memory:");
  try {
    for (const f of readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort())
      db.exec(readFileSync(join(REPO, "migrations", f), "utf8"));
    db.prepare("INSERT INTO snapshot(one,v,stamped) VALUES(1,'vQ',NULL)").run();
    book.purchases.forEach((row, i) => db.prepare("INSERT INTO entry(collection,seq,hash,doc) VALUES('purchases',?,?,?)")
      .run(i, "p" + i, JSON.stringify(row)));
    for (const [k, v] of Object.entries({ ...book.state, PRICING: book.pricing }))
      db.prepare("INSERT INTO state(key,doc) VALUES(?,?)").run(k, JSON.stringify(v));
    const winner = draftRow({ ...buy, payload: { ...buy.payload, total: winnerTotal, cash: winnerTotal } }, book);
    if (winner.skip) throw new Error(winner.skip);
    let planted = false;
    const plant = () => {
      if (planted) return;
      db.prepare("INSERT INTO draft(id,status,collection,entry,row,reasoning,drafter,drafted_at) VALUES(?,'pending','purchases',?,?,?,'other-pass',?)")
        .run(lotAt, JSON.stringify(buy), JSON.stringify(winner.row), "other pass", lotAt);
      planted = true;
    };
    const d1 = { prepare(sql) {
      const st = db.prepare(sql);
      const bound = (args) => ({
        async run() {
          if (sql.trim().startsWith("INSERT OR IGNORE INTO draft") && args[0] === lotAt) {
            if (when === "before-insert") plant();
            if (rejectWinner) db.prepare("UPDATE draft SET status='rejected' WHERE id=?").run(lotAt);
            if (editedTotal != null) {
              const edited = draftRow({ ...buy, payload: { ...buy.payload, total: editedTotal, cash: editedTotal } }, book);
              if (edited.skip) throw new Error(edited.skip);
              db.prepare("UPDATE draft SET row=? WHERE id=?").run(JSON.stringify(edited.row), lotAt);
            }
          }
          return { meta: { changes: Number(st.run(...args).changes) } };
        },
        async first() {
          if (failRead && planted && /SELECT id,row FROM draft WHERE id=\?1/.test(sql)) throw new Error("winner read refused");
          return st.get(...args) || null;
        },
        async all() {
          const results = st.all(...args);
          if (when === "after-snapshot" && sql.trim().startsWith("SELECT id FROM draft WHERE id IN (")) plant();
          return { results };
        }
      });
      return Object.assign(bound([]), { bind: (...args) => bound(args) });
    } };
    const kv = { async list() { return { keys: [{ name: "q:phone" }], list_complete: true }; },
      async get() { return JSON.stringify({ queue: [buy, sell] }); } };
    let result, error = null;
    try {
      result = dry ? await dryRunDrafter({ SALT_LEDGER: d1, SALT_QUEUE: kv })
        : await runDrafter({ SALT_LEDGER: d1, SALT_QUEUE: kv }, { mirror: async () => book });
    } catch (e) { error = String(e.message || e); }
    const stored = db.prepare("SELECT row FROM draft WHERE id=?").get(saleAt);
    const sale = dry ? result && result.would.find((d) => d.at === saleAt)?.row : stored && JSON.parse(stored.row);
    return { result, error, sale };
  } finally { db.close(); }
}

export async function run({ ok }) {
  const before = await exercise("after-snapshot");
  ok(before.result?.raced === 1 && before.sale?.cost === 24,
    "a lot another pass wrote before the lot read is counted once in the later sale: " + JSON.stringify(before));
  const after = await exercise("before-insert", { winnerTotal: 100 });
  ok(after.result?.raced === 1 && after.sale?.cost === 28,
    "a lot written after the lot read uses the winning stored row, not this pass's losing row: " + JSON.stringify(after));
  const failed = await exercise("before-insert", { failRead: true });
  ok(/winner read refused/.test(failed.error || "") && !failed.sale,
    "a refused winning-row read stops the pass before it can cost a sale: " + JSON.stringify(failed));
  const dry = await exercise("after-snapshot", { dry: true });
  ok(dry.sale?.cost === 24,
    "a dry run counts a lot that appeared after its id snapshot only once: " + JSON.stringify(dry));
  const rejected = await exercise("before-insert", { rejectWinner: true });
  ok(rejected.result?.raced === 1 && rejected.sale?.cost === 20,
    "a rejected winner absent from the lot read is not added to a later sale: " + JSON.stringify(rejected));
  const removed = await exercise("after-snapshot", { rejectWinner: true });
  ok(removed.result?.raced === 1 && removed.sale?.cost === 20,
    "a winner rejected after the lot read is removed from the cached lots: " + JSON.stringify(removed));
  const edited = await exercise("after-snapshot", { editedTotal: 100 });
  ok(edited.result?.raced === 1 && edited.sale?.cost === 28,
    "a cached winner edited after the lot read is replaced by its stored row: " + JSON.stringify(edited));
  const fresh = await exercise("none");
  ok(fresh.result?.drafted === 2 && fresh.sale?.cost === 24,
    "a purchase this pass made still costs a later sale: " + JSON.stringify(fresh));
}
