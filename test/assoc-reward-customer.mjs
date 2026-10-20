/* test/assoc-reward-customer.mjs: THE ASSOCIATE REWARD, P8: A CUSTOMER REDEEMS NOTHING FROM THE SWITCH (his answer to Ask 7, and to the loyalty
 * plan's Ask 4 of 20 Oct 2026: no customer basis; the refusals stay, and what customers hold stands as it is). Each check red under its own
 * mutation (test/assoc-reward-customer.mutations.json), on the desk's own book read off the master window:
 *   1  one place refuses: inputResource answers a customer's redemption, cover and Correction putting reward on their row with the refusal
 *   2  the reservation check reads it (entryReservationFault), and so does admission
 *   3  the drafter refuses a customer's redemption and cover in its own words
 *   4  Salt Admin offers no Redeem for a customer, refuses one sent, and its cover plan answers nothing; an associate's Redeem stands
 *   5  a customer's figure stands where it stood at the switch: a sale paid since moves nothing they hold
 *   6  the fold raises no unit for a customer, however much margin a paid order brings
 *   7  the Desk's cover plan answers nothing for a customer, and its customer card says held, never free */
import { pathToFileURL } from "node:url";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readBook } from "../tools/book.mjs";
import E from "../engine/position.mjs";
import { draftRow } from "../src/drafter.js";
import { checkInputAdmission } from "../src/input-admission.js";
import { makerInputCatalog, makerLedgerInput, makerCoverPlan } from "../src/maker-inputs.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function run({ ok }) {
  const desk = await readBook(), w = desk.w;
  try {
    const L = JSON.parse(JSON.stringify(desk.ledger));
    const book = { version: L.PRICING.v, state: L, sales: L.sales, purchases: L.purchases, pricing: L.PRICING };
    const eb = { sales: L.sales, purchases: L.purchases, state: L };
    const held = (c) => E.rewardAccount(eb, c);
    const customers = [...new Set(L.sales.map((s) => E.ownerCode(s.customer)))].filter((c) => !held(c).associate && held(c).held >= 1 - 1e-9);
    const cust = customers[0], assoc = Object.keys(L.REWARD_OPEN).find((c) => held(c).held > 0.009 && !held(c).error) || Object.keys(L.REWARD_OPEN)[0];
    const row = L.sales.find((s) => E.ownerCode(s.customer) === cust && (s.product || "salt") === "salt" && s.rid);
    const redeem = (party) => ({ at: "2031-01-02T01:00:00.000Z", payload: { mode: "redeem", product: "salt", party, qty: 1, date: "2031-01-02" } });
    const cover = { at: "2031-01-02T01:01:00.000Z", payload: { mode: "new", direction: "SELL", product: "salt", party: cust, qty: 1, total: 50, date: "2031-01-02", more: { coverUnits: 0.5, coverRM: 29 } } };
    const corr = { at: "2031-01-02T01:02:00.000Z", payload: { mode: "amend", kind: "Correction", direction: "SELL", rid: row.rid, fields: { rebate: true, rebateKg: 0.5, settledRM: 29 } } };
    const refused = (r) => !!r && /not redeemed: only an associate/.test(r.error || r || "");
    /* 1 */
    ok(!!cust && customers.length >= 3 && [redeem(cust), cover, corr].every((e) => refused(E.inputResource(e, eb))) && !(E.inputResource(redeem(assoc), eb) || {}).error,
      "one place refuses a customer's redemption, cover and reward Correction, and an associate's stands: " + JSON.stringify([cust, assoc, E.inputResource(redeem(assoc), eb)]));
    /* 2 */
    const empty = { prepare() { const s = { bind() { return s; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({ meta: { changes: 0 } }) }; return s; } };
    const adm = await checkInputAdmission(empty, redeem(cust), eb);
    ok(refused(E.entryReservationFault(redeem(cust), [], eb)) && refused(E.entryReservationFault(corr, [], eb)) && refused((adm.error || "")),
      "the reservation check and admission refuse it alike: " + JSON.stringify([E.entryReservationFault(redeem(cust), [], eb), adm]));
    /* 3 */
    const dr = draftRow(redeem(cust), book), dc = draftRow(cover, book);
    ok(/a customer's reward is not redeemed/.test(dr.skip || "") && /a customer's reward covers nothing/.test(dc.skip || ""),
      "the drafter refuses a customer's redemption and cover: " + JSON.stringify([dr.skip, dc.skip]));
    /* 4 */
    const cat = makerInputCatalog(book);
    const rc = (cat.rewards || []).find((r) => r.code === cust), ra = (cat.rewards || []).find((r) => r.code === assoc);
    const sent = makerLedgerInput("redeem", { at: "2031-01-02T01:03:00.000Z", code: cust, date: "2031-01-02" }, book, []);
    const cp = makerCoverPlan({ product: "salt", party: cust, qty: 1, total: 50, stream: null, at: "2031-01-02T01:04:00.000Z" }, book, []);
    ok(!!rc && rc.action === null && (!ra || ra.held <= 0.009 || ra.action !== null) && /not redeemed/.test(sent.error || "") && cp === null,
      "Salt Admin offers no Redeem for a customer, refuses one sent, and plans no cover: " + JSON.stringify([rc, ra && ra.action, sent.error, cp]));
    /* 5: a big paid sale of theirs after the switch */
    const top = Math.max(...L.sales.map((s) => E.rewardRid(s.rid)));
    const more = { ...eb, sales: L.sales.concat([{ rid: "s" + (top + 5), customer: cust, product: "salt", date: "2031-01-02", qty: 10, total: 5000, cost: 580, cash: 5000, deliveredQty: 10 }]) };
    ok(E.rewardAccount(more, cust).held === held(cust).held && E.rewardAccount(more, cust).earned === held(cust).earned,
      "a customer's figure stands where it stood: " + JSON.stringify([held(cust).held, E.rewardAccount(more, cust).held]));
    /* 6: the fold, on the frozen book, a customer's big order paid */
    const ENG = await import("../engine/apply.mjs"), { nextRid } = await import("../tools/rid.mjs"), { sortBook } = await import("../tools/sort-ledger.mjs");
    const FOLD = await import(pathToFileURL(join(REPO, "tools", "fold.mjs")).href + "?assoccustomer");
    const { frozenBook } = await import("./frozen.mjs");
    const ctx = Object.create(FOLD.planCtx, { nextRid: { value: nextRid }, sortBook: { value: sortBook }, reward: { value: { stated: L.REWARD.stated } }, today: { value: "2031-01-09" } });
    const fb = frozenBook(); fb.roster.push("CX1-ZED");
    fb.sales.push({ rid: "s9001", customer: "CX1-ZED", product: "salt", date: "2031-01-01", qty: 10, total: 5000, cost: 580, cash: 0, deliveredQty: 0 });
    const res = ENG.applyBatch(fb, { ok: true, count: 1, approved: [{ id: "2031-01-02T01:00:00.000Z", status: "approved", collection: "sales", amends: "s9001", amendKind: "Fulfilment", row: { cash: 0 },
      entry: { at: "2031-01-02T01:00:00.000Z", payload: { mode: "amend", kind: "Fulfilment", direction: "SELL", date: "2031-01-02", cash: 5000, kg: 0 } } }] }, { version: "v9999", rows: {} }, ctx);
    ok(res.ok && !res.book.sales.some((s) => s.rewardOf && s.customer === "CX1-ZED"), "the fold raises no unit for a customer: " + (res.ok ? "none" : res.problems));
    /* 7 */
    const crCard = String(w.eval("PROD='salt';recompute();(function(){var c=customerRewards();return JSON.stringify({plan:coverPlan(" + JSON.stringify(cust) + ",1,10),n:c.length})})()"));
    const tab = String(w.eval("tabConcentration()")), cards = tab.slice(Math.max(0, tab.indexOf("Customer rewards")));
    const j = JSON.parse(crCard);
    ok(j.plan === null && j.n >= 3 && tab.includes("Customer rewards") && !/ free<\/b>/.test(cards) && / held</.test(cards) && /From the switch a customer redeems nothing/.test(cards),
      "the Desk's cover plan answers nothing for a customer, and its card says held: " + JSON.stringify([j, tab.length]));
  } finally { desk.dom.window.close(); }
}
