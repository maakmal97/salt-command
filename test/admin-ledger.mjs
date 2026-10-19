/* test/admin-ledger.mjs: SALT ADMIN'S MINI LEDGER (16 Oct 2026). Orders > Ledger draws three tables in one order, Open orders, Pending orders and the
 * latest twenty, from what GET /all/maker/ledger answers, and shows no other part of Orders while it does. The page draws and never decides: the fixture
 * hands it the lists and it must show every row as it came, a book as its mark, a customer as its code. What is proved here, each check red under its own
 * mutation (test/admin-ledger.mutations.json):
 *   1  the three tables, their headings with the count, in that order, and only the ledger showing of Orders
 *   2  the nine columns of each, in order
 *   3  a row's cells: its id, date, code, mark, units, total, owed, handed over of ordered and stage
 *   4  no product word and no name is drawn; the figures that are goods out are said beside what is owed
 *   5  a table with nothing in it says so; a refusal is said and draws no table
 *   6  every table scrolls inside its own box, and its rules use the system's tokens, never a literal */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const COLS = ["Order", "Date", "Customer", "Book", "Units", "Total", "Owed", "Handed over", "Stage"];
const r = (rid, date, customer, product, qty, total, owed, advance, moved, stage) => ({ rid, date, customer, product, qty, total, paid: total - owed, owed, advance, moved, stage, pay: "x", deliv: "y" });
const OPEN = [r("s9", "2027-01-05", "CA1-BBB", "oil", 2, 200, 110, 5, 1, "Open · Advance"), r("s7", "2027-01-03", "CA1-CCC", "candy", 4, 80, 0, 0, 0, "Open · Deferred")];
const PENDING = [r("s10", null, "CA1-DDD", "salt", 1, 100, 100, 0, 0, "Pending")];
const RECENT = [OPEN[0], PENDING[0], r("s4", "2027-01-04", "CA1-DDD", "rice", 1, 30, 0, 0, 1, "Completed")];
const answer = (lists) => (route) => route === "/all/maker/ledger" ? { ok: true, version: 3, orders: 9, ...lists } : undefined;

const shown = (el) => { for (let e = el; e && e.id !== "roster"; e = e.parentElement) if (e.hidden) return false; return !!el; };
const cells = (tr) => [...tr.children].map((c) => c.textContent);

export async function run({ ok, pageWork }) {
  const open = async (opts) => {
    const p = await richOwnerPage({ pageWork, ...opts });
    byAct(p.d, "nav.orders").click(); await p.work.quiet();
    byAct(p.d, "part.orders.ledger").click(); await p.work.quiet();
    return p;
  };
  const p = await open({ extra: answer({ open: OPEN, pending: PENDING, recent: RECENT }) });
  try {
    const { d } = p;
    /* 1 */
    const heads = [...d.querySelectorAll("#oLedger h2")].map((h) => h.textContent);
    const order = [...d.querySelectorAll("#oLedger .salt-table-wrap")].map((x) => x.id);
    ok(JSON.stringify(heads) === JSON.stringify(["Open orders · 2", "Pending orders · 1", "Latest 20 orders · 3"]) && order.join() === "led-open,led-pending,led-recent",
      "the ledger is three tables in the order Open orders, Pending orders, the latest twenty, each headed with its count: " + JSON.stringify([heads, order]));
    const rest = ["makerOrderList", "makerReview", "makerClaims", "makerPools"].filter((id) => shown(d.getElementById(id)));
    ok(shown(d.getElementById("oLedger")) && rest.length === 0, "the ledger shows and no other part of Orders does: " + JSON.stringify(rest));
    byAct(d, "part.orders.group").click(); await p.work.quiet();
    const elsewhere = shown(d.getElementById("oLedger"));
    byAct(d, "part.orders.ledger").click(); await p.work.quiet();
    ok(!elsewhere && shown(d.getElementById("oLedger")), "and it shows in no other part of Orders: " + elsewhere);
    ok(/^The folded book: 9 orders\./.test(d.getElementById("ledgerStatus").textContent) && !shown(d.getElementById("makerOrderList")), "its line says how many orders are on the book: " + d.getElementById("ledgerStatus").textContent);
    /* 2 */
    const heading = [...d.querySelectorAll("#oLedger table")].map((t) => [...t.querySelectorAll("thead th")].map((th) => th.textContent).join());
    ok(heading.length === 3 && heading.every((h) => h === COLS.join()), "each table has the nine columns in order: " + JSON.stringify(heading));
    /* 3 */
    const first = d.querySelector('#led-open tr[data-rid="s9"]'), sec = d.querySelector('#led-open tr[data-rid="s7"]'), undated = d.querySelector('#led-pending tr[data-rid="s10"]');
    const c = first ? [...first.children] : [];
    ok(!!first && c.length === 9 && c[0].textContent === "s9" && c[1].textContent === "05 Jan 2027" && c[2].textContent === "CA1-BBB" && c[4].textContent === "2" && c[5].textContent === "RM 200.00"
      && c[6].firstChild.textContent === "RM 110.00" && c[7].textContent === "1 of 2" && c[8].textContent === "Open · Advance",
    "a row shows its id, date, code, units, total, owed, handed over of ordered and stage: " + JSON.stringify(first && cells(first)));
    ok(!!sec && cells(sec)[7] === "0 of 4" && cells(sec)[6] === "RM 0.00" && cells(sec)[8] === "Open · Deferred" && !!undated && cells(undated)[1] === "Undated",
      "a paid order owes RM 0.00 and has handed over none, and a row with no date says Undated: " + JSON.stringify([sec && cells(sec), undated && cells(undated)]));
    ok(!!first && first.querySelector(".salt-producttag .pwith svg") && !!sec.querySelector(".salt-producttag .pwith svg") && first.children[3].querySelector(".salt-producttag--oil") !== null,
      "a book is drawn as its mark, in the book's own tag");
    /* 4 */
    const small = first && first.children[6].querySelector("small");
    ok(!!small && small.textContent === "goods out, RM 5.00" && !sec.children[6].querySelector("small"), "what is out unpaid is said beside what is owed, and only where goods are out: " + (small && small.textContent));
    const text = d.getElementById("oLedger").textContent;
    ok(!/\b(salt|oil|candy|rice)\b/i.test(text) && /CA1-BBB/.test(text), "no book is named on it, and a customer is its code: " + text.slice(0, 120));
    /* 6 */
    const wraps = [...d.querySelectorAll("#oLedger .salt-table-wrap")];
    ok(wraps.length === 3 && wraps.every((x) => x.getAttribute("tabindex") === "0" && x.getAttribute("role") === "region" && x.getAttribute("aria-labelledby") === x.id + "-h" && x.querySelector("table.salt-table")),
      "each table sits in its own scrolling box that a keyboard can reach and a reader can name");
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n").split("\n").filter((l) => /ledgrp|#oLedger/.test(l));
    ok(css.length >= 5 && css.every((l) => !/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(l)), "the ledger's rules are written in the system's tokens, never a colour: " + css.length + " rules");
  } finally { p.w.close(); }

  /* 5 */
  const e = await open({ extra: answer({ open: [], pending: [], recent: [] }) });
  try {
    const none = [...e.d.querySelectorAll("#oLedger .rnone")].map((x) => x.textContent), heads = [...e.d.querySelectorAll("#oLedger h2")].map((h) => h.textContent);
    ok(JSON.stringify(none) === JSON.stringify(["No open orders.", "No pending orders.", "No orders on the book."]) && e.d.querySelectorAll("#oLedger table").length === 0
      && heads.every((h) => /· 0$/.test(h)), "a table with nothing in it says so and draws no empty head: " + JSON.stringify([none, heads]));
  } finally { e.w.close(); }
  const f = await open({ failRoutes: ["/all/maker/ledger"] });
  try {
    ok(/Check the connection/.test(f.d.getElementById("ledgerStatus").textContent) && f.d.querySelectorAll("#oLedger table").length === 0,
      "a read that fails is said on the part's line and draws no table: " + f.d.getElementById("ledgerStatus").textContent);
  } finally { f.w.close(); }
}
