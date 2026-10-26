/* test/admin-record-fields.mjs: SALT ADMIN RECORD, THE FIELDS OF EVERY FORM (25 Oct 2026, his canvas Salt Admin Record; 27 Oct 2026, his answers: Record's forms
 * in the language of Shop's This device). What is proved here, each check red under its own mutation (test/admin-record-fields.mutations.json):
 *   1  a field or a dropdown in a form is a row of a settings list, its name at the left and its control at the right, the rows that follow one another in one
 *      list (a choice of tiles between them ends it); no form of Record's fifteen draws a label over its field, and every row's name is three words at most
 *   2  a choice of two or three plain words is a Segment in its row (the sale's Type, the handover, a loan's Goods or Cash), each option keeping the tile's act
 *      and key, and it answers as the tiles did: Cash makes the loan's amount read RM
 *   3  the books stay typed tags, four up; a legend about one book ends in that book's typed tag, never its drawn mark
 *   4  every figure is set in mono and to the right
 *   5  a form's one pill crosses its foot on a phone and stands 240px at its right edge from 860px
 *   6  the sale's trip: Add a book is an action row, an added book's Remove this book a danger row, and the trip's line the grey line under them
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct, enter, tileGroup } from "./maker-act.mjs";

const J = JSON.stringify;
const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork });
  try {
    await p.work.quiet();
    const d = p.d, quiet = () => p.work.quiet();
    enter(d, "record"); await quiet();
    const form = (slug) => d.querySelector('#makerInputs section.maker-input[data-form="' + slug + '"]');
    const trade = form("sale-or-purchase"), gift = form("gift"), add = form("new-customer"), loan = form("loan");
    const forms = [...d.querySelectorAll("#makerInputs section.maker-input[data-form]")];
    /* 1 */
    const rowOf = (f, act) => { const c = byAct(f, act); return c && c.closest(".salt-settings__row"); };
    const giftRows = ["record.gift.party", "record.gift.date", "record.gift.units"].map((a) => rowOf(gift, a));
    const read = (r) => r ? [r.tagName, t(r.querySelector(".salt-settings__label")), r.lastElementChild.matches("input,select"), r.parentElement.classList.contains("salt-settings")] : null;
    const names = forms.flatMap((f) => [...f.querySelectorAll(".salt-settings__row .salt-settings__label")].map(t)).filter(Boolean);
    ok(J(giftRows.map(read)) === J([["LABEL", "Who", true, true], ["LABEL", "Date", true, true], ["LABEL", "Units", true, true]])
      && giftRows[1].parentElement === giftRows[2].parentElement && giftRows[1].nextElementSibling === giftRows[2] && giftRows[2].nextElementSibling === rowOf(gift, "record.gift.handover")
      && forms.length === 15 && forms.every((f) => !f.querySelector(".maker-field")) && names.length >= 30 && names.every((n) => n.split(" ").length <= 3),
      "a field or a dropdown is a row of a settings list, its name left and its control right, Gift's Date, Units and Handover one list under the books, no form draws a label over its field, every name three words at most: "
        + J([giftRows.map(read), forms.filter((f) => f.querySelector(".maker-field")).map((f) => f.getAttribute("data-form")), names.filter((n) => n.split(" ").length > 3)]));
    /* 2 */
    const seg = (f, act) => { const r = rowOf(f, act); const s = r && r.querySelector(".salt-segment"); return s ? [t(r.querySelector(".salt-settings__label")), s.getAttribute("role"), [...s.children].map((b) => [t(b), b.getAttribute("role"), b.getAttribute("data-key"), b.getAttribute("aria-checked")])] : null; };
    const type = seg(trade, "record.trade.direction"), hand = seg(trade, "record.trade.handover"), of = seg(loan, "record.loan.form");
    ok(J(type) === J(["Type", "radiogroup", [["Sale", "radio", "sale", "true"], ["Purchase", "radio", "purchase", "false"]]])
      && J(hand) === J(["Handover", "radiogroup", [["Not yet", "radio", "none", "true"], ["Collected", "radio", "collected", "false"], ["Delivered", "radio", "delivered", "false"]]])
      && J(of) === J(["Loan of", "radiogroup", [["Goods", "radio", "salt", "true"], ["Cash", "radio", "cash", "false"]]]) && !trade.querySelector('fieldset.maker-tiles [data-act="record.trade.handover"]'),
      "a choice of two or three plain words is a Segment in its row, each option keeping its act and key: " + J([type, hand, of]));
    const tap = (act, key) => { const c = byAct(loan, act, key); if (c) c.click(); };
    tap("record.loan.form", "cash"); await quiet();
    const amount = rowOf(loan, "record.loan.amount"), cashOn = t(amount && amount.querySelector(".salt-settings__label")), segNow = seg(loan, "record.loan.form");
    tap("record.loan.form", "salt"); await quiet();
    ok(cashOn === "RM" && !!segNow && J(segNow[2].map((x) => x[3])) === J(["false", "true"]) && t(amount && amount.querySelector(".salt-settings__label")) === "Units",
      "the Segment answers as the tiles did: Cash makes the loan's amount read RM, and Goods gives Units back: " + J([cashOn, segNow && segNow[2]]));
    /* 3 */
    const grid = (f, label) => { const g = tileGroup(f, label); return g ? g.querySelector(".salt-options__grid").className : null; };
    /* Starting % is a legend over its tiles, Other % a row's name: each about one book */
    const about = add ? [...add.querySelectorAll("fieldset.maker-tiles legend, .salt-settings__row .salt-settings__label")].filter((n) => n.querySelector(".salt-producttag")) : [];
    ok(grid(trade, "Book") === "salt-options__grid maker-marks" && [...tileGroup(trade, "Book").querySelectorAll(".salt-option__face")].every((f) => f.querySelector(".salt-producttag") && !f.querySelector("svg.psym"))
      && about.length === 2 && about.every((n) => n.lastElementChild.classList.contains("salt-producttag--salt") && t(n.lastElementChild) === "Salt") && !add.querySelector("legend svg.psym, legend .pwith, .salt-settings__label svg.psym"),
      "the books stay typed tags four up, and a name or a legend about one book (Starting %, Other %) ends in its typed tag, never its drawn mark: " + J([grid(trade, "Book"), about.map(t)]));
    /* 4 */
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    const outside = css.replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g, "");
    const nums = [...d.querySelectorAll("#makerInputs section.maker-input input[type=number]")];
    ok(nums.length >= 12 && nums.every((n) => n.classList.contains("salt-field__input--mono")) && /\.adm \.maker-input input\[type=number\]\{text-align:right\}/.test(css),
      "every figure is in mono and set to the right: " + nums.length + " fields");
    /* 5 */
    const send = byAct(trade, "record.trade.send");
    ok(!!send && send.parentElement === trade && send.classList.contains("salt-pill") && send.classList.contains("btn")
      && /\.adm \.maker-input>\.btn\.salt-pill\{width:100%;height:48px;margin-top:16px;white-space:nowrap/.test(outside) && /@media \(min-width:860px\)\{\.adm \.maker-input>\.btn\.salt-pill\{width:auto;min-width:240px;max-width:100%;justify-self:end\}\}/.test(css),
      "a form's one pill crosses its foot on a phone, one line, and from 860px stands at its right edge, 240px at least");
    /* 6 */
    const addBook = byAct(trade, "record.trade.add-book");
    const before = addBook && [addBook.className, t(addBook), addBook.parentElement.classList.contains("salt-settings"), addBook.parentElement.nextElementSibling && addBook.parentElement.nextElementSibling.className, t(addBook.parentElement.nextElementSibling)];
    addBook.click(); await quiet();
    const remove = byAct(trade, "record.trade.remove-book");
    ok(J(before) === J(["salt-settings__row salt-settings__row--action", "Add a book", true, "salt-settings__foot", "Same buyer, same day; delivery charged once; approved in one tap."])
      && !!remove && remove.classList.contains("salt-settings__row--danger") && t(remove) === "Remove this book" && remove.parentElement.classList.contains("salt-settings")
      && !!rowOf(trade, "record.trade.extra-units"),
      "the trip: Add a book an action row, the trip's line the grey line under it, an added book's rows a list and Remove this book a danger row: " + J([before, remove && remove.className]));
  } finally { p.w.close(); }
}
