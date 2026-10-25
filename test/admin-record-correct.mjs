/* test/admin-record-correct.mjs: SALT ADMIN RECORD, P5, CORRECT A ROW AND REOPEN (25 Oct 2026; his canvas Salt Admin Record and his Ask F). What is proved here, each check
 * red under its own mutation (test/admin-record-correct.mutations.json):
 *   1  the row is chosen by its reference, who and when; the row chosen stands as a card under the choice (its reference, units and day; its typed book and who; its
 *      total at the right), and with none chosen no card is drawn
 *   2  What to do is tiles carrying what each does under its words, the form's three opening notes gone into them; a purchase's row offers its six, each with its own
 *   3  the changes made ready are a ledger of the field and its new value, under Ready to send
 *   4  Reopen a cancelled order names the order the same way and stands its card under the choice
 *   5  the page's rules: the card one height (76px), its lines one line each, a move of History one line with its Undo at the right
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct, enter, tileGroup } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork, inputsAnswer: (j) => ({ ...j, catalog: { ...j.catalog,
    rows: [...j.catalog.rows, { rid: "row-2", party: "SX1-ZED", product: "oil", date: "2026-09-02", qty: 3, total: 90, direction: "BUY" }] } }) });
  try {
    await p.work.quiet();
    const d = p.d, quiet = () => p.work.quiet();
    enter(d, "record"); await quiet();
    const ed = d.querySelector('#makerInputs section.maker-input[data-form="correct-a-row"]');
    const pick = byAct(ed, "record.amend.row"), card = ed.querySelector(".rowcard");
    const choose = async (sel, v) => { sel.value = v; sel.dispatchEvent(new d.defaultView.Event("change", { bubbles: true })); await quiet(); };
    /* 1 */
    const opts = [...pick.options].map((o) => o.textContent);
    const hiddenFirst = card.hidden;
    await choose(pick, "row-1");
    const read = [t(card.querySelector(".rowcard__kind")), t(card.querySelector(".rowcard__rid")), card.querySelector(".rowcard__who .salt-producttag--salt") ? "salt" : "", t(card.querySelector(".rowcard__code")), t(card.querySelector(".rowcard__fig"))];
    ok(J(opts) === J(["Choose a row", "row-1 · CX1-ZED · 01 Sep 2026", "row-2 · SX1-ZED · 02 Sep 2026"]) && hiddenFirst && !card.hidden
      && J(read) === J(["row-1 · 2 units · 01 Sep 2026", "row-1", "salt", "CX1-ZED", "RM 200"]) && card.nextElementSibling === tileGroup(ed, "What to do"),
      "the row is chosen by its reference, who and when, and stands as a card under the choice, none drawn before: " + J([opts, read]));
    /* 2 */
    const tiles = () => [...tileGroup(ed, "What to do").querySelectorAll("input")].map((r) => [r.value, t(r.nextElementSibling.querySelector(".salt-option__label")), t(r.nextElementSibling.querySelector(".salt-option__detail"))]);
    const sale = tiles();
    await choose(pick, "row-2");
    const buy = tiles();
    ok(J(sale) === J([["Correction", "Change the figures", "Restate what was typed on the row."], ["Fulfilment", "Record goods or cash moved", "What was handed over or paid."], ["Cancellation", "Cancel the order", "Only while nothing has moved."]])
      && J(buy.map((x) => x[0])) === J(["Correction", "Fulfilment", "Cancellation", "Payment", "Receipt", "Default"]) && buy.every((x) => x[2])
      && ![...ed.children].some((c) => c.matches("p.msg") && /Change the figures|Goods or cash moved|Cancel the order/.test(c.textContent)),
      "What to do is tiles each saying what it does, the three opening notes gone into them, a purchase's six each with its own: " + J([sale, buy.map((x) => x[2])]));
    /* 3 */
    await choose(pick, "row-1");
    const field = byAct(ed, "record.amend.field"), value = () => byAct(ed, "record.amend.value");
    await choose(field, "qty"); value().value = "3"; byAct(ed, "record.amend.add-change").click(); await quiet();
    const ready = ed.querySelector(".maker-changes");
    ok(t(ready.querySelector(".salt-eyebrow")) === "Ready to send" && J([...ready.querySelectorAll(".salt-ledger__row")].map((r) => [r.getAttribute("data-change"), t(r.querySelector(".salt-ledger__label")), t(r.querySelector(".salt-ledger__value"))])) === J([["qty", "Units", "3"]]),
      "the changes made ready are a ledger of the field and its new value under Ready to send: " + t(ready));
    /* 4 */
    const rv = d.querySelector('#makerInputs section.maker-input[data-form="reopen-a-cancelled-order"]'), rcard = rv.querySelector(".rowcard");
    ok(J([...byAct(rv, "record.revive.row").options].map((o) => o.textContent)) === J(["row-3 · CX1-ZED · cancelled 03 Sep 2026"]) && !rcard.hidden
      && t(rcard.querySelector(".rowcard__kind")) === "row-3 · 1 unit · 02 Sep 2026" && t(rcard.querySelector(".rowcard__fig")) === "RM 100" && !!rcard.querySelector(".salt-producttag--salt"),
      "Reopen names the order by its reference, who and when it was cancelled, and stands its card under the choice: " + t(rcard));
    /* 5 */
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(/\.adm \.rowcard\{display:grid;grid-template-columns:minmax\(0,1fr\) auto;[^}]*height:76px;/.test(css) && /\.adm \.rowcard__kind\{[^}]*white-space:nowrap;overflow:hidden;text-overflow:ellipsis/.test(css)
      && /\.adm \.rowcard__fig\{grid-column:2;grid-row:1\/3;white-space:nowrap/.test(css)
      && /\.adm \[data-form="correct-a-row"\] \.undomove>\.maker-facts\{[^}]*white-space:nowrap;overflow:hidden;text-overflow:ellipsis\}/.test(css),
      "the card is one height, 76px, its lines one line each, and a move of History one line with its Undo at the right");
  } finally { p.w.close(); }
}
