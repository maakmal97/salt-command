/* test/assoc-reward-price.mjs: THE ASSOCIATE REWARD, P4: THEIR PRICE ON THE ROW (his rule 4, 20 Oct 2026). Each check red under its own
 * mutation (test/assoc-reward-price.mutations.json):
 *   1  the drafter stamps a salt sale from the switch with their own card at its size (listRM) and that size (listQty), off PRICING
 *   2  a sale dated before the switch and an oil sale carry no stamp
 *   3  an R2 resale, booked to the -R account, carries the associate's own card
 *   4  a partner's stamp is the Floor at that size, so what they pay at the Floor gives nought
 *   5  the fold stamps a restated size again, for the new size, off the same snapshot; a row with no stamp stays without
 *   6  the Worker's cardAt is the engine's: the one copy the drafter, the fold and every quote read
 *   7  and the fold tool itself carries the extract's pricing snapshot to the re-stamp */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { readBook } from "../tools/book.mjs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { draftRow, listStamp } from "../src/drafter.js";
import { cardAt } from "../src/orders.js";
import PRICING_ENGINE from "../engine/pricing.mjs";
import E from "../engine/position.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function run({ ok }) {
  /* the extract as the desk reads it, off the master window, never the repo's file */
  const desk = await readBook(), L = JSON.parse(JSON.stringify(desk.ledger));
  desk.dom.window.close();
  const book = { version: L.PRICING.v, state: L, sales: L.sales, purchases: L.purchases, pricing: L.PRICING };
  const since = L.REWARD.stated.salt.associate.since, assoc = Object.keys(L.REWARD_OPEN)[0];
  const partner = (L.partners || [])[0];
  const entry = (payload) => ({ at: "2031-01-02T01:00:00.000Z", payload: { mode: "new", product: "salt", direction: "SELL", date: "2031-01-02",
    qty: 1, total: 500, cash: 0, kg: 0, ...payload } });
  const card = (code, q) => PRICING_ENGINE.cardAt(book.pricing, code, "salt", q).card;
  /* 1 */
  const d1 = draftRow(entry({ party: assoc, qty: 1 }), book), d6 = draftRow(entry({ party: assoc, qty: 6.25, total: 900 }), book);
  ok(d1.row && d1.row.listRM === +(+card(assoc, 1)).toFixed(2) && d1.row.listQty === 1 && d6.row.listRM === +(+card(assoc, 6.25)).toFixed(2) && d6.row.listQty === 6.25
    && d1.row.listRM > 0, "a salt sale from the switch carries their own card at its size: " + JSON.stringify([d1.row && d1.row.listRM, d6.row && d6.row.listRM, card(assoc, 1)]));
  /* 2 */
  const before = draftRow(entry({ party: assoc, date: "2026-10-19" }), book);
  const oil = listStamp({ customer: assoc, product: "oil", qty: 1, date: "2031-01-02", total: 10 }, book);
  ok(before.row && before.row.listRM === undefined && before.row.listQty === undefined && oil.listRM === undefined && since === "2026-10-20",
    "a sale before the switch and an oil sale carry no stamp: " + JSON.stringify([before.row && before.row.listRM, oil.listRM]));
  /* 3 */
  const r2 = draftRow(entry({ party: assoc, assoc, stream: "R2", qty: 1 }), book);
  ok(r2.row && r2.row.customer === assoc + E.BUCKET_SFX && r2.row.listRM === +(+card(assoc, 1)).toFixed(2),
    "an R2 resale on the -R account carries the associate's own card: " + JSON.stringify(r2.row && [r2.row.customer, r2.row.listRM]));
  /* 4 */
  const pr = partner && listStamp({ customer: partner, product: "salt", qty: 1, date: "2031-01-02", total: 1 }, book);
  const floor = ((book.pricing.byProduct.salt.floors || {})["1"] || {}).floor;
  ok(!!pr && pr.listRM === floor && floor > 0, "a partner's stamp is the Floor: " + JSON.stringify([pr && pr.listRM, floor]));
  /* 5: the fold, on the frozen book, restates a stamped row from 1 unit to 2 */
  const ENG = await import("../engine/apply.mjs"), { nextRid } = await import("../tools/rid.mjs"), { sortBook } = await import("../tools/sort-ledger.mjs");
  const FOLD = await import(pathToFileURL(join(REPO, "tools", "fold.mjs")).href + "?assocprice");
  const { frozenBook } = await import("./frozen.mjs");
  const ctx = Object.create(FOLD.planCtx, { nextRid: { value: nextRid }, sortBook: { value: sortBook }, reward: { value: null }, today: { value: "2031-01-09" },
    pricing: { value: book.pricing } });
  const fb = frozenBook();
  fb.sales.push({ rid: "s9001", customer: assoc, product: "salt", date: "2031-01-02", qty: 1, total: 500, cash: 0, deliveredQty: 0, listRM: 1, listQty: 1 },
    { rid: "s9002", customer: assoc, product: "salt", date: "2031-01-02", qty: 1, total: 400, cash: 0, deliveredQty: 0 });
  const restate = (id, rid) => ({ id, status: "approved", collection: "sales", amends: rid, amendKind: "Correction", row: {},
    entry: { at: id, payload: { mode: "amend", kind: "Correction", direction: "SELL", date: "2031-01-03", fields: { qty: 2, total: 900 } } } });
  const st = { ok: true, count: 2, approved: [restate("2031-01-03T01:00:00.000Z", "s9001"), restate("2031-01-03T02:00:00.000Z", "s9002")] };
  const res = ENG.applyBatch(fb, st, { version: "v9999", rows: {} }, ctx);
  const a = res.ok && res.book.sales.find((s) => s.rid === "s9001"), b = res.ok && res.book.sales.find((s) => s.rid === "s9002");
  ok(res.ok && a.qty === 2 && a.listRM === +(+card(assoc, 2)).toFixed(2) && a.listQty === 2 && b.listRM === undefined,
    "the fold stamps a restated size again, and leaves an unstamped row unstamped: " + JSON.stringify(res.ok ? [a.listRM, a.listQty, b.listRM, card(assoc, 2)] : res.problems));
  /* 7: the fold reads the extract beside the book it folds (--ledger); the suite's book is the frozen fixture, so the window's is written to a temp file */
  const dir = mkdtempSync(join(tmpdir(), "assoc-price-")), extract = join(dir, "ledger.json");
  writeFileSync(extract, JSON.stringify({ ledger: { REWARD: L.REWARD, PRICING: L.PRICING } }));
  const argv = process.argv.slice();
  process.argv.push("--ledger", extract);
  const FOLD2 = await import(pathToFileURL(join(REPO, "tools", "fold.mjs")).href + "?assocprice-ledger");
  process.argv.splice(0, process.argv.length, ...argv);
  const fb2 = frozenBook();
  fb2.sales.push({ rid: "s9001", customer: assoc, product: "salt", date: "2031-01-02", qty: 1, total: 500, cash: 0, deliveredQty: 0, listRM: 1, listQty: 1 });
  const fr = FOLD2.apply(fb2, { ok: true, count: 1, approved: [restate("2031-01-03T01:00:00.000Z", "s9001")] },
    { version: "v9999", date: "03 Jan 2031", title: "A TEST", notes: ["<b>TEST.</b>"], rows: {}, stockNote: "" }, readFileSync(process.env.SALT_MASTER, "utf8"));
  const fa = fb2.sales.find((s) => s.rid === "s9001");
  ok(fr.ok && fa.listRM === +(+card(assoc, 2)).toFixed(2), "the fold tool re-stamps through its own apply: " + JSON.stringify(fr.ok ? fa.listRM : fr.problems));
  /* 6 */
  const anyQ = 3.1;
  ok(JSON.stringify(cardAt(book.pricing, assoc, "salt", anyQ)) === JSON.stringify(PRICING_ENGINE.cardAt(book.pricing, assoc, "salt", anyQ))
    && cardAt(book.pricing, assoc, "salt", anyQ).card > 0, "the Worker's cardAt is the engine's: " + JSON.stringify(cardAt(book.pricing, assoc, "salt", anyQ)));
}
