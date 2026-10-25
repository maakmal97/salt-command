/* test/admin-record-fields.mjs: SALT ADMIN RECORD, P3, THE FIELDS OF EVERY FORM (25 Oct 2026; his canvas Salt Admin Record). What is proved here, each check red under
 * its own mutation (test/admin-record-fields.mutations.json):
 *   1  a choice of three short words lies on one row (Handover: Not yet, Collected, Delivered); the books four up, each its typed tag
 *   2  a legend or a label about one book ends in that book's typed tag, never its drawn mark
 *   3  a form is two columns at every width: a short field (a number, a date, the sale's Who) beside the next, everything else across; a label is one line
 *   4  every figure is set in mono and to the right
 *   5  a form's one pill crosses its foot on a phone and stands 240px at its right edge from 860px
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct, enter, tileGroup } from "./maker-act.mjs";

const J = JSON.stringify;

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork });
  try {
    await p.work.quiet();
    const d = p.d, quiet = () => p.work.quiet();
    enter(d, "record"); await quiet();
    const form = (slug) => d.querySelector('#makerInputs section.maker-input[data-form="' + slug + '"]');
    const trade = form("sale-or-purchase"), gift = form("gift"), add = form("new-customer");
    /* 1 */
    const grid = (f, label) => { const g = tileGroup(f, label); return g ? g.querySelector(".salt-options__grid").className : null; };
    ok(grid(trade, "Handover") === "salt-options__grid maker-row maker-row--3" && grid(gift, "Handover") === "salt-options__grid maker-row maker-row--3"
      && grid(trade, "Book") === "salt-options__grid maker-marks" && [...tileGroup(trade, "Book").querySelectorAll(".salt-option__face")].every((f) => f.querySelector(".salt-producttag") && !f.querySelector("svg.psym")),
      "a choice of three short words lies on one row, and the books four up as typed tags: " + J([grid(trade, "Handover"), grid(trade, "Book")]));
    /* 2 */
    const legend = add && add.querySelector('fieldset.maker-tiles legend .salt-producttag--salt');
    ok(!!legend && !add.querySelector("legend svg.psym, legend .pwith") && legend.textContent.trim() === "Salt",
      "a legend about one book (New customer's Starting %) ends in that book's typed tag, never its drawn mark");
    /* 3 */
    const kids = [...trade.children].filter((c) => c.matches("label.maker-field"));
    const who = kids.find((c) => c.querySelector('[data-act="record.trade.party"]')), date = kids.find((c) => c.querySelector('[data-act="record.trade.date"]'));
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    const outside = css.replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g, "");
    ok(!!who && who.classList.contains("maker-field--short") && date.classList.contains("maker-field--short") && who.nextElementSibling === date
      && /\.adm \.maker-input\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(outside) && /\.adm \.maker-input>\.maker-field--short\{grid-column:auto/.test(outside)
      && /\.adm \.maker-field>\.lbl\{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis\}/.test(css),
      "a form is two columns at every width, the sale's Who beside its Date, and a label one line: " + J([who && who.className, date && date.className]));
    /* 4 */
    const nums = [...d.querySelectorAll("#makerInputs section.maker-input input[type=number]")];
    ok(nums.length >= 12 && nums.every((n) => n.classList.contains("salt-field__input--mono")) && /\.adm \.maker-input input\[type=number\]\{text-align:right\}/.test(css),
      "every figure is in mono and set to the right: " + nums.length + " fields");
    /* 5 */
    const send = byAct(trade, "record.trade.send");
    ok(!!send && send.parentElement === trade && send.classList.contains("salt-pill") && send.classList.contains("btn")
      && /\.adm \.maker-input>\.btn\.salt-pill\{width:100%;height:48px;margin-top:16px;white-space:nowrap/.test(outside) && /@media \(min-width:860px\)\{\.adm \.maker-input>\.btn\.salt-pill\{width:auto;min-width:240px;max-width:100%;justify-self:end\}\}/.test(css),
      "a form's one pill crosses its foot on a phone, one line, and from 860px stands at its right edge, 240px at least");
  } finally { p.w.close(); }
}
