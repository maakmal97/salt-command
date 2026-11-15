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
    /* 16 Nov 2026, the move to Ambient (place I): a field is Ambient's field, its label over its control; a choice of two or three plain words a Segment; the books a Choice
       with their chips; a wheel the stepper over values; the form's one pill the amb-foot */
    /* 1 */
    const rowOf = (f, act) => { const c = byAct(f, act); return c && c.closest(".amb-field"); };
    const giftRows = ["record.gift.party", "record.gift.date", "record.gift.units"].map((a) => rowOf(gift, a));
    const read = (r) => r ? [r.tagName, t(r.querySelector(".amb-field__label")), r.lastElementChild.matches("input,.amb-select"), r.classList.contains("amb-field") && !!r.parentElement.closest("section.maker-input")] : null;
    const names = forms.flatMap((f) => [...f.querySelectorAll(".amb-field__label")].map(t)).filter(Boolean);
    ok(J(giftRows.map(read)) === J([["LABEL", "Who", true, true], ["LABEL", "Date", true, true], ["LABEL", "Units", true, true]])
      && giftRows[1].nextElementSibling === giftRows[2] && giftRows[2].nextElementSibling === rowOf(gift, "record.gift.handover")
      && forms.length === 15 && forms.every((f) => !f.querySelector(".maker-field, .salt-settings__row, .salt-field__input")) && names.length >= 30 && names.every((n) => n.split(" ").length <= 3),
      "a field or a dropdown is Ambient's field, its label over its control, Gift's Date, Units and Handover one after another under the books, no form draws a settings row or a salt field, every name three words at most: "
        + J([giftRows.map(read), forms.filter((f) => f.querySelector(".maker-field, .salt-settings__row")).map((f) => f.getAttribute("data-form")), names.filter((n) => n.split(" ").length > 3)]));
    /* 2 */
    const seg = (f, act) => { const r = rowOf(f, act); const s = r && r.querySelector(".amb-segment"); return s ? [t(r.querySelector(".amb-field__label")), s.getAttribute("role"), [...s.children].map((b) => [t(b), b.getAttribute("role"), b.getAttribute("data-key"), b.getAttribute("aria-pressed")])] : null; };
    const type = seg(trade, "record.trade.direction"), hand = seg(trade, "record.trade.handover"), of = seg(loan, "record.loan.form");
    /* 03 Nov 2026 (his decision: Record records no new sale): with no row chosen the Type stands on Purchase (its row hidden, held by Record's new-sale checks in test/order-stream-v6.mjs) */
    ok(J(type) === J(["Type", "group", [["Sale", null, "sale", "false"], ["Purchase", null, "purchase", "true"]]])
      && J(hand) === J(["Handover", "group", [["Not yet", null, "none", "true"], ["Collected", null, "collected", "false"], ["Delivered", null, "delivered", "false"]]])
      && J(of) === J(["Loan of", "group", [["Goods", null, "salt", "true"], ["Cash", null, "cash", "false"]]]) && !trade.querySelector('fieldset.maker-tiles [data-act="record.trade.handover"]'),
      "a choice of two or three plain words is a Segment in its field, each option keeping its act and key: " + J([type, hand, of]));
    const tap = (act, key) => { const c = byAct(loan, act, key); if (c) c.click(); };
    tap("record.loan.form", "cash"); await quiet();
    const amount = rowOf(loan, "record.loan.amount"), cashOn = t(amount && amount.querySelector(".amb-field__label")), segNow = seg(loan, "record.loan.form");
    tap("record.loan.form", "salt"); await quiet();
    ok(cashOn === "RM" && !!segNow && J(segNow[2].map((x) => x[3])) === J(["false", "true"]) && t(amount && amount.querySelector(".amb-field__label")) === "Units",
      "the Segment answers as the tiles did: Cash makes the loan's amount read RM, and Goods gives Units back: " + J([cashOn, segNow && segNow[2]]));
    /* 3 */
    const bookSet = tileGroup(trade, "Book");
    /* Starting % is a legend over its tiles, Other % a field's label: each about one book */
    const about = add ? [...add.querySelectorAll("fieldset.maker-tiles legend, .amb-field__label")].filter((n) => n.querySelector(".amb-chip")) : [];
    ok(bookSet.classList.contains("amb-options") && [...bookSet.querySelectorAll("label.amb-option")].every((o) => o.querySelector(".amb-option__title > .amb-chip[class*='amb-kind-'] > .amb-chip__dot") && !o.querySelector("svg.psym, .salt-producttag"))
      && about.length === 2 && about.every((n) => n.lastElementChild.classList.contains("amb-chip") && /amb-kind-1\b/.test(n.lastElementChild.className) && t(n.lastElementChild) === "Salt") && !add.querySelector("legend svg.psym, legend .pwith, .amb-field__label svg.psym"),
      "the books are a Choice of chips, the dot in the book's hue and its name in ink, and a label or a legend about one book (Starting %, Other %) ends in its chip, never its drawn mark: " + J([bookSet.className, about.map(t)]));
    /* 4 */
    const nums = [...d.querySelectorAll("#makerInputs section.maker-input input[type=number]")];
    /* 27 Oct 2026: Units and Handed over are wheels; 16 Nov 2026: each the stepper over its sizes, the plain figures beside them */
    const wheels = [...d.querySelectorAll("#makerInputs section.maker-input input[data-amb-values]")];
    ok(nums.length >= 10 && wheels.length >= 2 && nums.every((n) => n.classList.contains("amb-input")) && wheels.every((w) => w.parentElement.classList.contains("amb-stepper") && w.step === "any" && /^(0 )?0\.25 /.test(w.getAttribute("data-amb-values")) && w.parentElement.querySelectorAll("[data-amb-step]").length === 2
      && w.parentElement.parentElement.classList.contains("amb-field") && w.max === "200"),
      "every figure is in the Ambient input, and a wheel is the stepper over its sizes, a quarter to 25 then whole to 200: " + nums.length + " fields, " + wheels.length + " wheels");
    /* 5 */
    const send = byAct(trade, "record.trade.send");
    /* 16 Nov 2026 (Ambient): the pill stands in the form's amb-foot, a child of the form, the pill across it */
    ok(!!send && send.parentElement.parentElement === trade && send.parentElement.classList.contains("amb-foot") && send.classList.contains("amb-pill") && send.classList.contains("amb-pill--block") && !send.classList.contains("amb-pill--quiet"),
      "a form's one pill is its amb-foot, a block pill and never a quiet one");
    /* 6 */
    const addBook = byAct(trade, "record.trade.add-book");
    const before = addBook && [addBook.className, t(addBook), addBook.parentElement.tagName, addBook.parentElement.parentElement.classList.contains("amb-settings__list"), t(addBook.closest(".amb-settings").nextElementSibling), addBook.closest(".amb-settings").nextElementSibling.className];
    addBook.click(); await quiet();
    const remove = byAct(trade, "record.trade.remove-book");
    ok(J(before) === J(["amb-action", "Add a book", "LI", true, "Same buyer, same day; delivery charged once; approved in one tap.", "amb-field__hint"])
      && !!remove && remove.classList.contains("amb-action--danger") && t(remove) === "Remove this book" && remove.parentElement.parentElement.classList.contains("amb-settings__list")
      && !!rowOf(trade, "record.trade.extra-units"),
      "the trip: Add a book an action in a list, the trip's line the hint under it, an added book's fields and Remove this book a danger action: " + J([before, remove && remove.className]));
  } finally { p.w.close(); }
}
