/* test/admin-reward-label.mjs: A UNIT THE FOLD RAISED SAYS WHICH IT IS (22 Oct 2026, his word "put a label as Associate reward").
 * What is proved here, each check red under its own mutation (test/admin-reward-label.mutations.json):
 *   1  makerRows carries `reward` on a row with `rewardOf`: "associate", or "loyal" on a loyalty unit, with the order it came of; nothing on any other row
 *   2  Salt Admin's Orders row carries the label, Associate reward or Loyalty unit, and an ordinary row none
 *   3  its card carries the label by the stage and a line naming the order it came of */
import { makerRows } from "../src/maker-inputs.js";
import { richOwnerPage, byAct } from "./maker-act.mjs";

const J = JSON.stringify;
const text = (n) => (n && n.textContent || "").replace(/\s+/g, " ").trim();

export async function run({ ok, pageWork }) {
  /* 1 */
  const sales = [
    { rid: "s1", customer: "CQ9-ZED", qty: 1, total: 120, cash: 120, date: "2026-10-21", deliveredQty: 1 },
    { rid: "s2", customer: "CQ9-ZED", qty: 1, total: 60, cost: 60, cash: 0, settledRM: 60, rebate: true, rebateKg: 1, goodwill: true, deliveredQty: 0, date: "2026-10-22", rewardOf: "s1", auto: true },
    { rid: "s3", customer: "CQ5-ZED", qty: 1, total: 0, cost: 60, cash: 0, goodwill: true, loyal: true, deliveredQty: 0, date: "2026-10-22", rewardOf: "s9" },
    { rid: "s4", customer: "CQ5-ZED", qty: 1, total: 60, cost: 60, cash: 0, settledRM: 60, goodwill: true, deliveredQty: 1, date: "2026-10-20" }];
  const rows = makerRows({ sales });
  const by = (rid) => rows.find((r) => r.rid === rid) || {};
  ok(by("s2").reward === "associate" && by("s2").rewardOf === "s1" && by("s3").reward === "loyal" && by("s3").rewardOf === "s9" && !("reward" in by("s1")) && !("rewardOf" in by("s1")) && !("reward" in by("s4")),
    "makerRows labels a raised unit, an associate's reward or a loyalty unit, with the order it came of, and no other row, a gift he gave included: " + J(rows.map((r) => [r.rid, r.reward, r.rewardOf])));

  /* 2, 3 */
  const D = "2026-10-22";
  const ROWS = [
    { rid: "fr1", party: "CQ9-ZED", product: "salt", date: D, key: "k1", qty: 1, total: 60, delivery: 0, paid: 60, owed: 0, handed: 0, left: 1, waiting: 0, stage: "paid", gift: true, reward: "associate", rewardOf: "s1" },
    { rid: "fl1", party: "CQ5-ZED", product: "salt", date: D, key: "k2", qty: 1, total: 0, delivery: 0, paid: 0, owed: 0, handed: 0, left: 1, waiting: 0, stage: "paid", gift: true, reward: "loyal", rewardOf: "s9" },
    { rid: "fa1", party: "CQ9-ZED", product: "salt", date: D, key: "k3", qty: 1, total: 110, delivery: 0, paid: 0, owed: 110, handed: 0, left: 1, waiting: 0, stage: "confirmed" }];
  const p = await richOwnerPage({ pageWork, bare: true, review: (j) => ({ ...j, orders: [], drafts: [], queue: [], trips: [], sameDay: [], rows: ROWS }) });
  try {
    await p.work.quiet();
    byAct(p.d, "nav.orders").click(); await p.work.quiet();
    const rowOf = (k) => p.d.querySelector('[data-act="order.open"][data-key="' + k + '"]');
    const lab = (k) => [...(rowOf(k) || { querySelectorAll: () => [] }).querySelectorAll(".salt-status")].map(text);
    ok(lab("row:fr1").includes("Associate reward") && lab("row:fl1").includes("Loyalty unit") && !lab("row:fa1").some((t) => /reward|Loyalty/i.test(t)),
      "the Orders row carries Associate reward or Loyalty unit, an ordinary row neither: " + J([lab("row:fr1"), lab("row:fl1"), lab("row:fa1")]));
    byAct(p.d, "order.open", "row:fr1").click(); await p.work.quiet();
    const card = p.card("row:fr1");
    ok(!!card && [...card.querySelectorAll(".lead .salt-status")].map(text).includes("Associate reward")
      && /Associate reward for s1, at cost and free to them/.test(text(card)),
      "its card carries the label by the stage and names the order it came of: " + text(card && card.querySelector(".lead")));
  } finally { p.w.close(); }
}
