/* test/admin-record-sale-edit.mjs: SALT ADMIN RECORD, THE SALE FORM IN HIS ORDER AND EVERY CHANGE IN IT (27 Oct 2026, his word: Record's sale form in the order he enters
 * it, Who typed, Units on a wheel, their price filled, and a row changed in this form and nowhere else). What is proved here, each check red under its own mutation
 * (test/admin-record-sale-edit.mutations.json):
 *   a  the rows stand in his order: Row, Type, Book, Who, Date, Units, Price, Add a book, then Handover, Delivery, Handed over and Cash paid in one tail list, then the pill
 *   b  Who is a text input over a datalist of the catalog's parties; Units and Handed over are wheels (0.25 to 200; Handed over from 0), and a figure off the wheel is put on it
 *   c  their price fills once Who and Units are set, from a reading asked without a total; a price he types stands when Units changes (its value; the mark is not asserted); clearing it brings theirs back
 *   d  a row chosen under Row fills the form; Record the change posts one Correction of what differs and one Fulfilment of what was paid or handed over since; an unchanged
 *      form posts nothing and says so; less than the book holds posts nothing
 *   e  a cancelled row loads with its fields shut, its pill Reopen this sale, and posts the Reopen Correction
 *   f  a Ledger row's reference and amendFor open the sale form on that row; Record's menu has no Fixing group, and Correct a row is reached from Other fields
 *   g  when the Correction's post fails, the next tap posts the Correction again and then the Fulfilment
 *   h  the Desk's reading of a sale with no total is only its price (direction, book, units, card), and the card is the engine's cardAt figure for that customer and size
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct, enter, tileGroup } from "./maker-act.mjs";
import { fixturePricing } from "./maker-trade-reading.mjs";
import { makerTradeReading } from "../src/maker-inputs.js";
import { cardAt } from "../src/orders.js";

const J = JSON.stringify;
const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const AMEND = "/all/maker/inputs/ledger-amend";

/* the catalog's rows, as the Desk serves them: row-1 has had RM 50 paid and 1 unit handed over, row-4 sits off the wheel, row-3 was cancelled */
const catalogWith = (j) => {
  j.catalog.rows = [{ rid: "row-1", party: "CX1-ZED", product: "salt", date: "2026-09-01", qty: 2, total: 200, direction: "SELL", cash: 50, movedUnits: 1, delivery: 0, handover: "collected" },
    { rid: "row-4", party: "CX2-ZED", product: "salt", date: "2026-09-04", qty: 3.3, total: 330, direction: "SELL", cash: 0, movedUnits: 0.3, delivery: 0, handover: null }];
  j.catalog.revivable = [{ rid: "row-3", party: "CX1-ZED", product: "salt", date: "2026-09-02", qty: 1, total: 100, paid: 0, movedUnits: 0, cancelledOn: "2026-09-03", direction: "SELL" }];
  return j;
};
const LEDGER = { ok: true, version: 1, orders: 1, open: [], pending: [], recent: [{ rid: "row-1", date: "2026-09-01", customer: "CX1-ZED", product: "salt", qty: 2, total: 200, owed: 150, advance: 0, moved: 1, stage: "Open" }] };

export async function run({ ok, pageWork }) {
  const asked = [];
  const extra = (route, body) => {
    if (route === "/all/maker/ledger") return LEDGER;
    if (route === "/all/maker/trade-reading" && body && body.total === undefined) { asked.push(body); return { ok: true, reading: { direction: "sale", product: body.product, qty: body.qty, card: { rm: 110 * body.qty, note: "Their % on the Set Price." } } }; }
    return undefined;
  };
  const p = await richOwnerPage({ pageWork, extra, inputsAnswer: catalogWith, probe: true });
  try {
    await p.work.quiet();
    const d = p.d, w = p.w, quiet = () => p.work.quiet();
    enter(d, "record"); await quiet();
    const f = d.querySelector('#makerInputs section.maker-input[data-form="sale-or-purchase"]');
    const A = (a, k) => byAct(f, a, k);
    const fire = (c, type) => c.dispatchEvent(new w.Event(type, { bubbles: true }));
    const put = (act, v, type = "input") => { const c = A(act); c.value = v; fire(c, type); if (type === "input") fire(c, "change"); return c; };
    const amends = (from) => p.posts.slice(from).filter((x) => x.route === AMEND).map((x) => x.body);
    const choose = async (rid) => { const pick = A("record.trade.edit"); pick.value = rid; fire(pick, "change"); await quiet(); };
    const status = () => t(f.querySelector(":scope > p[role=status]"));
    const pill = () => t(A("record.trade.send"));
    const shown = (el) => { for (let e = el; e && e.id !== "roster"; e = e.parentElement) if (e.hidden) return false; return !!el; };

    /* a */
    const after = (x, y) => !!x && !!y && (x.compareDocumentPosition(y) & 4) === 4;
    const seq = [A("record.trade.edit"), A("record.trade.direction"), tileGroup(f, "Book"), A("record.trade.party"), A("record.trade.date"), A("record.trade.units"), A("record.trade.total"), A("record.trade.add-book")];
    const tail = f.querySelector(".maker-trade-tail"), tailNames = tail ? [...tail.querySelectorAll(":scope > .salt-settings__row > .salt-settings__label")].map(t) : [];
    ok(seq.every((x, i) => !!x && (i === 0 || after(seq[i - 1], x))) && !!tail && after(seq[7], tail) && J(tailNames) === J(["Handover", "Delivery", "Handed over", "Cash paid"])
      && after(tail, A("record.trade.send")) && pill() === "Record the sale" && A("record.trade.send").parentElement === f
      && !f.querySelector(":scope > .salt-settings:not(.maker-trade-tail) [data-act='record.trade.cash'], :scope > .salt-settings:not(.maker-trade-tail) [data-act='record.trade.moved']"),
      "the sale form stands in his order: Row, Type, Book, Who, Date, Units, Price, Add a book, then Handover, Delivery, Handed over and Cash paid in one tail list, then Record the sale: "
        + J([seq.map((x) => !!x), tailNames, pill()]));

    const typeTap = async (v) => { const b = byAct(f, "record.trade.direction", v); if (b) b.click(); await quiet(); return pill(); };
    const asPurchase = await typeTap("purchase"), asSale = await typeTap("sale");
    ok(asPurchase === "Record the purchase" && asSale === "Record the sale", "the pill follows the Type: Record the purchase, then Record the sale again: " + J([asPurchase, asSale]));

    /* b */
    const who = A("record.trade.party"), list = f.querySelector("#makerWhoList"), units = A("record.trade.units"), moved = A("record.trade.moved");
    const vals = (s) => [...s.options].map((o) => o.value);
    ok(who.tagName === "INPUT" && who.type === "text" && who.getAttribute("list") === "makerWhoList" && !!list && list.tagName === "DATALIST"
      && J([...list.options].map((o) => o.value)) === J(["CX1-ZED", "CX2-ZED", "SX1-ZED", "AX1-ZED", "AX1-ZED-R"])
      && units.tagName === "SELECT" && units.classList.contains("mwheel") && vals(units)[0] === "0.25" && vals(units)[1] === "0.5" && vals(units).includes("25") && vals(units).includes("26") && vals(units).pop() === "200" && units.value === "1"
      && moved.tagName === "SELECT" && moved.classList.contains("mwheel") && vals(moved)[0] === "0" && vals(moved)[1] === "0.25" && vals(moved).pop() === "200" && moved.value === "0",
      "Who is a text input over a datalist of the catalog's parties; Units is a wheel from 0.25 to 200 and Handed over one from 0: "
        + J([who.tagName, who.getAttribute("list"), list && list.options.length, vals(units).slice(0, 2), vals(units).slice(-1), vals(moved).slice(0, 2), moved.value]));

    /* c */
    const total = A("record.trade.total");
    put("record.trade.party", "CX1-ZED"); put("record.trade.units", "2", "change"); await quiet();
    const filled = [total.value, total.hasAttribute("data-their"), asked.length > 0 && asked.every((b) => b.total === undefined && b.direction === "sale" && b.party === "CX1-ZED")];
    put("record.trade.total", "300"); put("record.trade.units", "3", "change"); await quiet();
    const typed = [total.value];
    put("record.trade.total", ""); await quiet();
    const back = [total.value, total.hasAttribute("data-their")];
    ok(J(filled) === J(["220", true, true]) && typed[0] === "300" && J(back) === J(["330", true]),
      "their price fills from a reading asked without a total and is marked; a price he types stands when Units changes (its value; the mark is not asserted); clearing it brings theirs back: " + J([filled, typed, back]));

    /* d */
    await choose("row-1");
    const loaded = [["record.trade.party", "CX1-ZED"], ["record.trade.date", "2026-09-01"], ["record.trade.units", "2"], ["record.trade.total", "200"], ["record.trade.cash", "50"], ["record.trade.moved", "1"]]
      .map(([a, v]) => [a, A(a).value === v]);
    const loadedPill = pill();
    put("record.trade.total", "205"); put("record.trade.cash", "60");
    const before = p.posts.length;
    A("record.trade.send").click(); await quiet();
    const sent = amends(before);
    ok(loaded.every((x) => x[1]) && loadedPill === "Record the change" && sent.length === 1 + 1
      && sent[0].kind === "Correction" && sent[0].rid === "row-1" && J(sent[0].fields) === J({ total: 205 })
      && sent[1].kind === "Fulfilment" && sent[1].rid === "row-1" && sent[1].cash === 10 && sent[1].movedUnits === 0,
      "a row chosen under Row fills the form and Record the change posts one Correction of the price and one Fulfilment of the cash since: " + J([loaded, loadedPill, sent]));
    await choose(""); await choose("row-1");
    const none0 = p.posts.length;
    A("record.trade.send").click(); await quiet();
    const nothing = [amends(none0).length, status()];
    put("record.trade.cash", "40");
    const less0 = p.posts.length;
    A("record.trade.send").click(); await quiet();
    const less = [amends(less0).length, status()];
    ok(nothing[0] === 0 && /Nothing has changed/.test(nothing[1]) && less[0] === 0 && /less than the book holds/.test(less[1]),
      "an unchanged form posts nothing and says Nothing has changed; a lower Cash paid posts nothing and says what to use: " + J([nothing, less]));

    /* b again, on the off-wheel row */
    await choose("row-4");
    const ov = vals(A("record.trade.units")), mv = vals(A("record.trade.moved"));
    ok(A("record.trade.units").value === "3.3" && ov.indexOf("3.25") + 1 === ov.indexOf("3.3") && ov.indexOf("3.3") + 1 === ov.indexOf("3.5")
      && A("record.trade.moved").value === "0.3" && mv.indexOf("0.25") + 1 === mv.indexOf("0.3"),
      "a row's figure off the wheel is put on it in its place, units and handed over alike: " + J([A("record.trade.units").value, A("record.trade.moved").value]));

    /* e */
    await choose("row-3");
    const shut = ["record.trade.party", "record.trade.date", "record.trade.units", "record.trade.total", "record.trade.cash", "record.trade.moved"].map((a) => A(a).disabled);
    const reopenPill = pill(), reopen0 = p.posts.length;
    A("record.trade.send").click(); await quiet();
    const reopened = amends(reopen0);
    ok(shut.every(Boolean) && reopenPill === "Reopen this sale" && reopened.length === 1 && reopened[0].kind === "Correction" && reopened[0].rid === "row-3"
      && J(reopened[0].fields) === J({ cancelled: false, cancelledOn: null }),
      "a cancelled row loads with its fields shut, its pill Reopen this sale, and posts the Reopen Correction: " + J([shut, reopenPill, reopened]));

    /* f */
    await choose("row-1");
    const more = [...f.querySelectorAll(".maker-edit-more .salt-settings__label")].map(t);
    const other = A("record.trade.other"); other && other.click(); await quiet();
    const fix = d.querySelector('#makerInputs section.maker-input[data-form="correct-a-row"]');
    const fixAt = fix ? [byAct(fix, "record.amend.row").value, shown(fix), shown(f)] : null;
    await choose("");
    enter(d, "orders"); await quiet(); byAct(d, "part.orders.ledger").click(); await quiet();
    const open = byAct(d, "ledger.open", "row-1");
    open && open.click(); await quiet();
    const viaLedger = [A("record.trade.edit").value, pill(), shown(f)];
    await choose("");
    enter(d, "orders"); await quiet();
    w.__owner("amendFor('row-4')"); await quiet();
    const viaAmend = [A("record.trade.edit").value, pill(), shown(f)];
    const heads = [...d.querySelectorAll('#makerMenu [data-in="record.entry"] > .salt-settings__head')].map(t);
    ok(!!open && t(open) === "row-1" && J(viaLedger) === J(["row-1", "Record the change", true]) && J(viaAmend) === J(["row-4", "Record the change", true])
      && J(heads) === J(["Everyday", "Now and then"])
      && J(more) === J(["Other fields"]) && J(fixAt) === J(["row-1", true, false]),
      "a Ledger row's reference and amendFor open the sale form on that row, Record's menu has no Fixing group, and Other fields (to Correct a row) sits under the form and opens Correct a row on that row: " + J([viaLedger, viaAmend, more, fixAt, heads]));

    /* g */
    await choose("row-1");
    put("record.trade.total", "207"); put("record.trade.cash", "70");
    p.fail.add(AMEND);
    const try0 = p.posts.length;
    A("record.trade.send").click(); await quiet();
    const failed = amends(try0);
    p.fail.delete(AMEND);
    const retry0 = p.posts.length;
    A("record.trade.send").click(); await quiet();
    const retried = amends(retry0);
    ok(failed.length >= 1 && failed.every((b) => b.kind === "Correction") && retried.length === 2 && retried[0].kind === "Correction" && J(retried[0].fields) === J({ total: 207 })
      && retried[1].kind === "Fulfilment" && retried[1].cash === 20 && retried[1].movedUnits === 0,
      "when the Correction's post fails, the next tap posts the Correction again and then the Fulfilment: " + J([failed.map((b) => b.kind), retried]));
  } finally { p.w.close(); }

  /* h */
  const pricing = await fixturePricing();
  const book = { version: "edit-fixture", sales: [], purchases: [], pricing, state: { PRODUCTS: { salt: {}, oil: {} }, roster: ["CX1-ZED", "SX1-ZED"] } };
  pricing.v = book.version;
  const bare = makerTradeReading({ direction: "sale", product: "salt", party: "CX1-ZED", qty: 3 }, book);
  const want = cardAt(pricing, "CX1-ZED", "salt", 3);
  const full = makerTradeReading({ direction: "sale", product: "salt", party: "CX1-ZED", qty: 3, total: 330 }, book);
  const stranger = makerTradeReading({ direction: "sale", product: "salt", party: "ZZ9-NOPE", qty: 3 }, book);
  const noTotalBuy = makerTradeReading({ direction: "purchase", product: "salt", qty: 3 }, book);
  ok(!bare.error && J(Object.keys(bare).sort()) === J(["card", "direction", "product", "qty"]) && bare.direction === "sale" && bare.product === "salt" && bare.qty === 3
    && want.card != null && !!bare.card && bare.card.rm === +want.card && bare.card.note === want.cardNote
    && !!full.card && full.card.rm === bare.card.rm && !!full.margin && stranger.card === null && !!noTotalBuy.error,
    "a sale read with no total answers only its price, the engine's cardAt figure for that customer and size, a full reading carries the same card, a stranger has none and a purchase still needs its total: "
      + J([bare, want.card, stranger.card, noTotalBuy.error]));
}
