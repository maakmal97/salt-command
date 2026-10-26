/* test/admin-record-trade.mjs: SALT ADMIN RECORD, P4, THE SALE OR PURCHASE (25 Oct 2026; his canvas Salt Admin Record and his Asks D and E). What is proved here, each
 * check red under its own mutation (test/admin-record-trade.mutations.json):
 *   1  Through an associate? stands before Who, since it says what Who is; its tiles are No, Resells and Introduced, the full words spoken
 *   2  the reading is a ledger under its eyebrow: Cost a unit, Goods a unit, Margin over cost, Floor for the units, Their usual a unit, each its label, its figure and
 *      what stands behind it; a loss is the figure in ember, and the warning under the Floor stays a sentence
 *   3  the reward cover is one ticked row: the use in words, what they hold under it, the figure at the right
 *   4  the page's rules: a reading row and the cover one line each, the figure never cut
 * Drawn by the maker harness (test/maker-act.mjs), answering the reading and the cover itself. Invented codes and figures. */
import { richOwnerPage, byAct, enter, tileGroup, tile } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;
const READING = { cogs: { rate: 42, source: "the latest purchase" }, goods: 100, price: 33.33, qty: 3, margin: { rm: -26, pct: -26, belowCost: true },
  floor: { rm: 130, warn: "RM 30 under the Floor of RM 130 for 3 units." }, history: { median: 140, count: 3, low: 130, high: 150, offMedianPct: -76, recent: [{ rate: 150 }, { rate: 140 }] } };

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork, extra: (route) => route === "/all/maker/trade-reading" ? { ok: true, reading: READING }
    : route === "/all/maker/trade-cover" ? { ok: true, cover: { units: 0.75, rm: 30, free: 2 } } : undefined });
  try {
    await p.work.quiet();
    const d = p.d, quiet = () => p.work.quiet();
    enter(d, "record"); await quiet();
    const trade = d.querySelector('#makerInputs section.maker-input[data-form="sale-or-purchase"]');
    const set = async (act, v) => { const f = byAct(trade, act); f.value = v; f.dispatchEvent(new d.defaultView.Event("input", { bubbles: true })); f.dispatchEvent(new d.defaultView.Event("change", { bubbles: true })); await quiet(); };
    /* 1 */
    /* 27 Oct 2026 (Record's forms as settings rows): the choice is the Associate Segment (its options buttons, R3's word Referred) and Who is a row in the list that follows it */
    const stream = tileGroup(trade, "Associate"), who = byAct(trade, "record.trade.party").closest("label").parentNode;
    const radios = [...stream.querySelectorAll("button.salt-segment__opt")];
    ok(stream.closest(".maker-trade-attribution").nextElementSibling === who
      && J(radios.map((r) => [r.getAttribute("data-value"), t(r), r.getAttribute("aria-label")])) === J([["", "No", null], ["R2", "Resells", "They resell"], ["R3", "Referred", "They introduced the buyer"]]),
      "Associate stands just before Who, its options No, Resells and Referred, the full words spoken: " + J(radios.map((r) => t(r))));
    /* 2 */
    await set("record.trade.units", "3"); await set("record.trade.total", "100");
    const box = trade.querySelector(".maker-reading"), rows = [...box.querySelectorAll(".reading-rows .salt-ledger__row")];
    const read = rows.map((r) => [r.getAttribute("data-reading"), t(r.querySelector(".salt-ledger__label")), t(r.querySelector(".salt-ledger__value")), t(r.querySelector(".salt-ledger__flag"))]);
    ok(t(box.querySelector(".reading-head")) === "Reading" && J(read) === J([
        ["Cost a unit", "Cost a unit", "RM 42.00", "From the latest purchase."], ["Goods, a unit", "Goods, a unit", "RM 33.33", "Goods RM 100.00."],
        ["Margin over cost", "Margin over cost", "RM -26.00 · -26%", ""], ["Floor for 3 units", "Floor for 3 units", "RM 130.00", "Cost times the size."],
        ["Their usual a unit", "Their usual a unit", "RM 140.00", "3 orders, RM 130.00 to RM 150.00: this is 76% below. Recent: RM 150.00, RM 140.00."]])
      && rows[2].querySelector(".salt-ledger__value").classList.contains("reading-bad") && !rows[0].querySelector(".reading-bad")
      && J([...box.querySelectorAll("p.msg.bad")].map(t)) === J(["RM 30 under the Floor of RM 130 for 3 units."]),
      "the reading is a ledger, label, figure and what stands behind it, a loss in ember and the warning a sentence: " + J(read));
    /* 3 */
    const cover = trade.querySelector(".maker-cover");
    ok(!cover.hidden && t(cover.querySelector(".maker-cover__words")) === "Use 0.75 unit of their reward" && t(cover.querySelector(".maker-cover__held")) === "They hold 2 units"
      && t(cover.querySelector(".maker-cover__fig")) === "RM 30.00 off" && cover.lastElementChild.classList.contains("maker-cover__fig") && cover.firstElementChild.type === "checkbox",
      "the reward cover is one ticked row: the use in words, what they hold under it, the figure at the right: " + t(cover));
    /* 4 */
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(/\.adm \.reading-rows \.salt-ledger__label\{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis\}/.test(css) && /\.adm \.reading-rows \.salt-ledger__value\{flex:none;white-space:nowrap/.test(css)
      && /\.adm \.reading-rows \.salt-ledger__flag\{white-space:nowrap;overflow:hidden;text-overflow:ellipsis\}/.test(css) && /\.adm \.maker-cover__fig\{flex:none;white-space:nowrap/.test(css)
      && /\.adm \.maker-cover__words,\.adm \.maker-cover__held\{display:block;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis\}/.test(css)
      && /\.adm \.maker-cover-row \.maker-cover\{flex:1 1 auto;min-width:0\}/.test(css),
      "a reading row and the cover are one line each, the figure never cut and the words an ellipsis at most");
  } finally { p.w.close(); }
}
