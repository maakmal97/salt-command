/* test/order-stream-v8-list.mjs: ONE LIST ON THE COUNTER (plan version 7, 7a to 7d, his answers of 02 Nov 2026). Each check red under its own
 * mutation (test/order-stream-v8-list.mutations.json). The live statement is built by the real publish (liveFor) on an invented book, the
 * Counter page is the real stmt/page.js in jsdom (test/counter-b-kit.mjs open()), every code and name invented:
 *   7a the live order lines carry data-d, data-g, data-dv and data-b, the list is marked data-lines="orders"; a refund row and an issued
 *      statement carry none of it
 *   7b Orders draws, after their site orders, the lines no order holds as Earlier by month: a line is held by day, goods (or the total before
 *      a close), delivery and book, each of which leaves it unheld when it differs; the desk's acknowledgement day holds too; a cancelled
 *      order holds nothing; one order holds one line and one line one order; Earlier is folded, newest month first, the undated last, and
 *      its Month select filters it; it stands under the wide columns and for an account with no site order
 *   7c Account has no order lines and no month filter and keeps the money and Refunds; Full statement opens the whole body in a Sheet, the
 *      filter works in it, and the close button and Escape shut it
 *   7d the year card counts a book from data-b, not from the drawing */
import { FROZEN_BOOK } from "./frozen.mjs";
import { readFileSync } from "node:fs";
import { stmtRows, stmtDoc } from "../tools/make_statements.mjs";

const U = "CX1-ZED";
const SALT = 0, OIL = 1;

export async function run({ ok, pageWork }) {
  const K = await import("./counter-b-kit.mjs");
  const { liveFor } = await import("../tools/make_statements.mjs");
  const now = new Date();
  const d10 = K.kl(-10), d45 = K.kl(-45), d80 = K.kl(-80);
  const sale = (rid, product, date, total, more = {}) => ({ rid, customer: U, product, date, qty: 1, total, cost: 40, cash: 0, deliveredQty: 1, ...more });
  const sales = [
    sale("r1", "salt", d10, 100),                          /* held: oHeld */
    sale("r2", "salt", d10, 150),                          /* unheld: oGoods says 160 */
    sale("r3", "oil", d45, 60),                            /* unheld: oBook is salt */
    sale("r4", "salt", d45, 80, { delivery: 10 }),         /* unheld: oDel says no delivery */
    sale("r5", "salt", d80, 200),                          /* held by the desk's acknowledgement day: oAck */
    sale("r6", "oil", d80, 90),                            /* unheld: oDay is a day out */
    sale("r7", "salt", d10, 300),                          /* held by the total before a close: oClosed */
    sale("r8", "salt", d45, 70),                           /* unheld: its order is cancelled */
    sale("r9", "salt", d45, 75, { cancelled: true }),      /* held: its cancelled order holds its own cancelled line */
    sale("rp1", "salt", d10, 111), sale("rp2", "salt", d10, 111),   /* both held: two orders */
    sale("rs1", "salt", d10, 222), sale("rs2", "salt", d10, 222),   /* one held: one order */
    sale("ru", "salt", null, 55, { date: undefined, pending: true, deliveredQty: 0 }),   /* undated */
  ];
  const doc = liveFor({ sales, customerRefunds: [{ party: U, since: d10, amount: 20, rid: "f1" }] }, U, now, "abcd-efgh");
  ok(!!doc && /data-lines="orders"/.test(doc.body), "the fixture: the real publish wrote a live statement of the invented book");
  const parsed = new (await import("jsdom")).JSDOM("<body>" + doc.body + "</body>").window.document;
  const lineRows = [...parsed.querySelectorAll('.salt-lines[data-lines="orders"] > .salt-lines__row')];
  const dated = lineRows.filter((r) => r.hasAttribute("data-d"));

  /* ---- 7a ---- */
  ok(lineRows.length === sales.length && dated.length === sales.length - 1
      && lineRows.every((r) => r.hasAttribute("data-g") && r.hasAttribute("data-dv") && /^-?[0-9]+$/.test(r.getAttribute("data-b")))
      && dated.every((r) => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(r.getAttribute("data-d")) && r.getAttribute("data-d").slice(0, 7) === r.getAttribute("data-m")),
    "7a every live order line carries its goods, delivery and book, and its day when it has one: " + lineRows.length + " lines, " + dated.length + " dated");
  const r4 = lineRows.find((r) => r.getAttribute("data-g") === "80");
  ok(!!r4 && r4.getAttribute("data-dv") === "10" && r4.getAttribute("data-b") === String(SALT) && lineRows.find((r) => r.getAttribute("data-g") === "60").getAttribute("data-b") === String(OIL),
    "7a the delivery is the row's delivery and the book is the index in the page's own mark table (salt 0, oil 1)");
  const refundRows = [...parsed.querySelectorAll(".salt-lines:not([data-lines]) .salt-lines__row")];
  ok(refundRows.length === 1 && !refundRows[0].hasAttribute("data-g") && !refundRows[0].hasAttribute("data-d") && !refundRows[0].hasAttribute("data-b")
      && !parsed.querySelector(".tot [data-g], .tot [data-b]"),
    "7a a refund row and the money rows carry none of it");
  /* an issued statement: the same rows through stmtDoc without live keep their table and carry none of it */
  const book = JSON.parse(readFileSync(FROZEN_BOOK, "utf8"));
  const party = [...new Set(book.sales.map((s) => s.customer))].find((c) => stmtRows(c, { from: null, to: K.kl(0), completed: true, open: true, pending: true, dates: true }).length);
  const issuedOpts = { from: null, to: K.kl(0), completed: true, open: true, pending: true, dates: true, brand: null, issued: "x", live: false, user: null };
  const issuedRows = stmtRows(party, issuedOpts);
  const issued = stmtDoc(party, issuedRows, { ...issuedOpts, refunds: [], recon: [] });
  ok(issuedRows.length > 0 && /<table/.test(issued) && !/data-lines|data-g=|data-dv=|data-b=/.test(issued),
    "7a an issued statement keeps its table and none of the line data");

  /* ---- the orders that hold lines ---- */
  const at = (day) => day + "T04:00:00.000Z";
  const o = (id, day, extra) => K.ord(id, "agreed", at(K.kl(-90)), { product: "salt", total: 100, delivery: 0, rowOn: day, ...extra });
  const orders = [
    o("oheld", d10, { total: 100 }),
    o("ogoods", d10, { total: 160 }),
    o("obook", d45, { product: "salt", total: 60 }),
    o("odel", d45, { total: 80, delivery: 0 }),
    o("oack", null, { total: 200, rowOn: undefined, history: [{ at: at(d80), status: "placed", by: "customer" }, { at: at(d80), status: "acknowledged", by: "desk" }] }),
    o("oday", K.kl(-79), { product: "oil", total: 90 }),
    o("oclosed", d10, { total: 120, closed: { at: at(d10), qty: 1, total: 300 } }),
    K.ord("ocx", "cancelled", at(K.kl(-90)), { product: "salt", total: 70, rowOn: d45 }),
    K.ord("ocx2", "cancelled", at(K.kl(-91)), { product: "salt", total: 75, rowOn: d45 }),
    o("op1", d10, { total: 111 }), o("op2", d10, { total: 111 }),
    o("os1", d10, { total: 222 }),
  ];
  const keyOf = (r) => [r.getAttribute("data-b"), r.getAttribute("data-g"), r.getAttribute("data-d") || "-", r.getAttribute("data-dv")].join("|");
  const heldKeys = ["0|100|" + d10 + "|0", "0|200|" + d80 + "|0", "0|300|" + d10 + "|0"];
  const unheld = ["0|150|" + d10 + "|0", "1|60|" + d45 + "|0", "0|80|" + d45 + "|10", "1|90|" + d80 + "|0", "0|70|" + d45 + "|0", "0|222|" + d10 + "|0", "0|55|-|0"];
  const earlierRows = (p) => [...p.d.querySelectorAll("#pOrder [data-earlier] .salt-lines__row")];
  const fold = (p) => p.d.querySelector("#pOrder [data-earlier-fold]");

  const pages = [];
  try {
    const p = await K.open({ ok, pageWork, orders, body: doc.body }); pages.push(p);
    const f = fold(p);
    ok(!!f && f.getAttribute("aria-expanded") === "false" && earlierRows(p).length === 0 && /^[0-9]+ earlier lines$/.test(K.txt(f)),
      "7b Earlier stands folded behind one button that counts the lines no order holds: " + (f ? K.txt(f) : "none"));
    ok(f && K.txt(f) === unheld.length + " earlier lines", "7b the count is the lines no order holds (" + unheld.length + "): " + (f ? K.txt(f) : "none"));
    f.click(); await p.settle();
    const keys = earlierRows(p).map(keyOf).sort();
    ok(JSON.stringify(keys) === JSON.stringify(unheld.slice().sort()), "7b Earlier holds exactly the unheld lines: " + JSON.stringify(keys));
    ok(heldKeys.every((k) => !keys.includes(k)), "7b a line a site order holds (by day, by the desk's acknowledgement day, by the total before a close) is not drawn in Earlier");
    ok(keys.includes("0|150|" + d10 + "|0"), "7b a line whose goods differ from the order's stays unheld");
    ok(keys.includes("1|60|" + d45 + "|0"), "7b a line of another book stays unheld");
    ok(keys.includes("0|80|" + d45 + "|10"), "7b a line whose delivery differs stays unheld");
    ok(keys.includes("1|90|" + d80 + "|0"), "7b a line a day out stays unheld");
    ok(keys.includes("0|70|" + d45 + "|0"), "7b a cancelled order holds no live line");
    ok(!keys.includes("0|75|" + d45 + "|0"), "7b a cancelled order holds its own cancelled line, so a sale is drawn once (Fable's review)");
    ok(earlierRows(p).length > 0 && [...p.d.querySelectorAll("#pOrder [data-earlier] .salt-lines")].every((l) => !!l.querySelector(".salt-lines__head")),
      "7b each month's lines carry the column names (Fable's review)");
    ok((await import("../stmt/page.js")).landingPage("abcd-efgh", "nbb", true).includes('id="fsSheet"'), "7c his own page (View as them, Order as them) carries the Full statement Sheet (Fable's review)");
    ok(keys.filter((k) => k === "0|222|" + d10 + "|0").length === 1 && !keys.includes("0|111|" + d10 + "|0"),
      "7b one order holds one line and one line one order: two orders hold two identical lines, one order only one of two");
    const heads = [...p.d.querySelectorAll("#pOrder [data-earlier] h3")].map(K.txt);
    const monthOf = (day) => day.slice(0, 7);
    const ms = [d10, d45, d80].map(monthOf);
    const mname = (m) => ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][+m.slice(5, 7) - 1] + " " + m.slice(0, 4);
    ok(heads.length === 3 && JSON.stringify(heads.map((h) => h.replace(/\s+/g, " "))) === JSON.stringify(ms.map(mname)),
      "7b Earlier is grouped by month, the newest first: " + JSON.stringify(heads));
    const groups = [...p.d.querySelectorAll("#pOrder [data-earlier] .salt-lines")];
    ok(groups.length === 4 && groups[3].querySelectorAll(".salt-lines__row").length === 1 && !groups[3].querySelector("[data-m]"),
      "7b an undated line stands in a group of its own, last: " + groups.length + " groups");
    ok(groups.every((g) => g.classList.contains("salt-lines--list")), "7b Earlier uses the lines recipe");
    /* the Month select */
    const sel = p.d.querySelector("#pOrder [data-earlier] select[data-mf-select]");
    ok(!!sel && [...sel.options].map((x) => x.value).join(",") === ["", ...ms].join(","), "7b the Month select lists All, then the months newest first: " + (sel ? [...sel.options].map((x) => x.value) : "none"));
    const shown = () => earlierRows(p).filter((r) => r.style.display !== "none" && r.closest(".salt-lines").style.display !== "none").length;
    ok(shown() === unheld.length, "7b the whole of Earlier shows at first");
    sel.value = monthOf(d45); sel.dispatchEvent(new p.w.Event("change", { bubbles: true }));
    const n45 = earlierRows(p).filter((r) => r.getAttribute("data-m") === monthOf(d45)).length;
    ok(shown() === n45 + 1 && n45 === 3, "7b the Month select filters Earlier to its month (an undated line shows whatever is chosen): " + shown());
    /* a poll's redraw keeps the open fold and the month */
    p.d.querySelector('#pOrder [data-otab="open"]').click(); p.d.querySelector('#pOrder [data-otab="all"]').click(); await p.settle();
    const sel2 = p.d.querySelector("#pOrder [data-earlier] select[data-mf-select]");
    ok(fold(p).getAttribute("aria-expanded") === "true" && sel2 && sel2.value === monthOf(d45), "7b a redraw keeps Earlier open and its month");
    fold(p).click(); await p.settle();
    ok(fold(p).getAttribute("aria-expanded") === "false" && earlierRows(p).length === 0, "7b the fold shuts again");

    /* ---- 7c ---- */
    const out = p.d.getElementById("out");
    ok(!out.querySelector('[data-lines="orders"]') && !out.querySelector(".salt-lines__row[data-g]"), "7c Account has no order lines");
    ok(p.d.getElementById("mfil").hidden && !p.d.querySelector("#out select"), "7c Account has no month filter");
    ok(!!out.querySelector(".tot") && /Refunds/.test(K.txt(out.querySelector("h3.whol"))) && out.querySelectorAll(".salt-lines__row").length === 1,
      "7c Account keeps the money rows and Refunds");
    const fb = p.d.getElementById("fsOpen");
    ok(!!fb && K.txt(fb) === "Full statement" && p.d.getElementById("fsSheet").hidden, "7c one ghost button, Full statement, under the money; the Sheet is shut");
    fb.click(); await p.settle();
    const fs = p.d.getElementById("fsSheet"), fo = p.d.getElementById("fsOut");
    ok(!fs.hidden && fo.querySelectorAll('[data-lines="orders"] > .salt-lines__row').length === sales.length && !!fo.querySelector(".tot"),
      "7c Full statement opens the whole document, every order line and the money, in a Sheet");
    ok(fs.getAttribute("role") === "dialog" && fs.getAttribute("aria-modal") === "true" && p.d.activeElement === fs, "7c it is a modal Sheet and takes the focus");
    const fsel = p.d.querySelector("#fsMf select");
    ok(!!fsel && !p.d.getElementById("fsMf").hidden, "7c the Month select is inside the Sheet");
    fsel.value = monthOf(d80); fsel.dispatchEvent(new p.w.Event("change", { bubbles: true }));
    const fshown = [...fo.querySelectorAll("[data-m]")].filter((r) => r.style.display !== "none");
    ok(fshown.length > 0 && fshown.every((r) => r.getAttribute("data-m") === monthOf(d80)) && fshown.length < sales.length, "7c the filter works inside the Sheet: " + fshown.length);
    p.d.getElementById("fsX").click(); await p.settle();
    ok(fs.hidden && p.d.activeElement === p.d.getElementById("fsOpen"), "7c the close button shuts it and gives the focus back to Full statement");
    fb.click(); await p.settle();
    const open2 = !fs.hidden;
    p.d.dispatchEvent(new p.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    ok(open2 && fs.hidden, "7c Escape shuts it");

    /* ---- the wide columns ---- */
    const wide = await K.open({ ok, pageWork, orders, body: doc.body, width: 1200 }); pages.push(wide);
    const wl = wide.d.querySelector("#pOrder [data-olist]");
    ok(!!wl.querySelector(".ocols") && !!wl.querySelector("[data-earlier]") && wl.querySelector(".ocols").nextElementSibling === wl.querySelector("[data-earlier]"),
      "7b Earlier stands under the wide columns");

    /* ---- no site order at all ---- */
    const none = await K.open({ ok, pageWork, orders: [], body: doc.body }); pages.push(none);
    ok(!!none.d.querySelector("#pOrder [data-earlier-fold]") && !none.d.querySelector("#pOrder .oempty"),
      "7b an account with no site order still lists its statement's lines");
    /* ---- nothing without a live statement ---- */
    const plain = await K.open({ ok, pageWork, orders }); pages.push(plain);
    ok(!plain.d.querySelector("#pOrder [data-earlier]"), "7b nothing is drawn as Earlier when the live statement has no order lines");

    /* a document with no order lines list (an issue, or a live one published before the lines carried it) is drawn as it was */
    const tbl = await K.open({ ok, pageWork, body: '<table><tbody><tr data-m="2026-09"><td>a</td></tr><tr data-m="2026-08"><td>b</td></tr></tbody></table>' }); pages.push(tbl);
    ok(!tbl.d.getElementById("fsOpen") && !tbl.d.getElementById("mfil").hidden && tbl.d.querySelectorAll("#mfil select option").length === 3,
      "7c a document with no order lines list is drawn whole, with its month filter and no Full statement");

    /* ---- 7d ---- */
    const m0 = K.kl(0).slice(0, 7);
    const yb = (b) => '<div class="salt-lines" data-lines="orders"><div class="salt-lines__row" data-m="' + m0 + '"' + (b == null ? "" : ' data-b="' + b + '"')
      + '><div class="salt-lines__what"><span class="mtile"><span class="mq">3</span></span></div></div></div>';
    const units = async (b) => { const y = await K.open({ ok, pageWork, body: yb(b) }); pages.push(y); const u = y.d.querySelector(".hyear__units"); return u ? u.innerHTML : ""; };
    const units2 = async (body) => { const y = await K.open({ ok, pageWork, body }); pages.push(y); const u = y.d.querySelector(".hyear__units"); return u ? u.innerHTML : ""; };
    const [uSalt, uOil, uNone] = [await units(SALT), await units(OIL), await units(null)];
    ok(uSalt && uOil && uNone && uSalt !== uOil && uSalt !== uNone && uOil !== uNone,
      "7d the year card counts a book from the line's data-b, with no drawing to read");
    /* a line published before data-b has only its drawing: an oil line without the attribute reads as oil */
    const oilDoc = liveFor({ sales: [sale("y1", "oil", K.kl(0), 60)], customerRefunds: [] }, U, now, "abcd-efgh");
    const withB = await units2(oilDoc.body), without = await units2(oilDoc.body.replace(/ data-b="[0-9-]+"/g, ""));
    ok(!!withB && withB === without && withB !== uSalt,
      "7d a line with no data-b falls back to its drawing");
  } finally { for (const p of pages) p.close(); }
}
