/* test/order-import-admin.mjs: SALT ADMIN KEEPS AN OLDER SALE'S ORDER TO THE BOOK (20 Nov 2026, docs/plan-order-import.html, Part 4, Ask G).
 *   A1 a done imported order's card draws no Change, Cash received or Handed over, and says "An older sale: change it on the book."
 *   A2 it keeps its pill, its history and its message box; a done order that is not imported keeps Change and says nothing of the sort
 *   A3 the line adds no tap (rule 6); Salt Admin's read carries `imported`, the customer's whitelist never does
 *   C1 the customer's page reads its history line as plain Complete, never naming the import, and offers Order again
 *   C2 a customer may still write on it
 * Every group is red under its own mutation (test/order-import-admin.mutations.json). */
import { richOwnerPage, byAct } from "./maker-act.mjs";
import { customerView, decideCustomer, applyEvent } from "../stmt/orders.js";
import { open, done, txt, LIST } from "./counter-b-kit.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const AT = "2026-11-10T00:00:00.000Z";
const mk = (id, extra) => Object.assign({ id, u: "abcd-efgh", product: "salt", qty: 1, unit: "unit", total: 100, delivery: 0, paid: 100, moved: 1, movedOn: "2026-11-10", mode: "collect", status: "done",
  at: AT, msgs: [], payments: [], history: [{ at: AT, status: "done", by: "import" }] }, extra || {});

export async function run({ ok, pageWork }) {
  /* A */
  const imp = mk("20261110000000-i501", { imported: true, rid: "s501" }), open2 = mk("20261110000000-i504", { imported: true, rid: "s504", status: "ready", moved: 0, paid: 0, mode: "collect", point: "A2", history: [{ at: AT, status: "ready", by: "desk" }] }), plain = mk("20261110000000-p502", { at: "2026-11-10T01:00:00.000Z" }),
    claimed = mk("20261110000000-i505", { imported: true, rid: "s505", status: "ready", moved: 0, paid: 0, mode: "collect", point: "A2", payments: [{ at: "2026-11-12T02:00:00.000Z", amount: 40, claim: "waiting" }], claimed: 40, history: [{ at: AT, status: "ready", by: "desk" }] });
  const p = await richOwnerPage({ pageWork, review: (j) => ({ ...j, orders: (j.orders || []).concat([imp, plain, open2, claimed]) }) });
  try {
    await p.work.quiet();
    const d = p.d;
    const { cardOf } = await import("./maker-act.mjs");
    const ci = cardOf(d, imp.id), cp = cardOf(d, plain.id);
    await p.work.quiet();
    const acts = (c) => [...c.querySelectorAll("[data-act]")].map((e) => e.getAttribute("data-act"));
    const ia = ci ? acts(ci) : [];
    ok(!!ci && !ia.includes("order.amend") && !ia.some((a) => /^order\.(cash|handed|pay)/.test(a)) && /An older sale: change it on the book\./.test(t(ci)),
      "A1: an imported done order has no Change, Cash received or Handed over, and says to change it on the book: " + JSON.stringify(ia) + " / " + t(ci).slice(0, 200));
    ok(!!ci && /Order log|This customer/.test(t(ci)) && !!ci.querySelector(".ohead") && !!ci.querySelector(".oldsale"),
      "A2: it keeps its head, its history and its customer row: " + t(ci).slice(0, 200));
    const co = cardOf(d, open2.id); await p.work.quiet();
    const oa = co ? acts(co) : [];
    ok(!!co && !oa.includes("order.amend") && !oa.some((a) => /^order\.(cash|handed|pay)/.test(a)) && /An older sale: change it on the book\./.test(t(co)),
      "A1: an imported order that a book change has reopened at Ready draws no Change, Cash received or Handed over either: " + JSON.stringify(oa));
    const cc = cardOf(d, claimed.id); await p.work.quiet();
    const ca = cc ? acts(cc) : [];
    ok(!!cc && ca.some((a) => /^order\.claim-received/.test(a)) && ca.some((a) => /^order\.claim-not-found/.test(a)) && !ca.includes("order.amend") && !ca.some((a) => /^order\.(cash|handed|pay)/.test(a)),
      "A4: a customer's claim on a reopened imported order can still be answered, Received and Not found, with no Cash received or Handed over: " + JSON.stringify(ca));
    ok(!!cp && acts(cp).includes("order.amend") && !/An older sale/.test(t(cp)), "A2: a done order that is not imported keeps Change and says nothing of the book: " + JSON.stringify(acts(cp || d)));
    ok(!!ci && ci.querySelector(".oldsale") && !ci.querySelector(".oldsale button, .oldsale a"), "A3: the line is plain text, so it adds no tap to size");
  } finally { p.w.close(); }
  const rawOrder = mk("20261110000000-i503", { imported: true, rid: "s503", ledgerKey: "X|2026-11-10|100", rateAsk: AT, queued: { ack: AT } });
  const cv = customerView(rawOrder);
  ok(!("imported" in cv) && !("rid" in cv) && !("queued" in cv), "A3: the customer's view carries no imported mark, rid or queue: " + JSON.stringify(Object.keys(cv)));

  /* C */
  const pages = [];
  try {
    const ago = (m) => new Date(Date.now() - m * 60000).toISOString();
    const O = done("oI", ago(300), { imported: true, history: [{ at: ago(300), status: "done", by: "import" }] });
    const P = await open({ pageWork, orders: [O] }); pages.push(P);
    P.d.querySelector('button[data-t="order"]').click(); await P.settle();
    const e = P.d.querySelector(".olater"); if (e && e.getAttribute("aria-expanded") !== "true") { e.click(); await P.settle(); }
    P.d.querySelector('#pOrder button[data-row="oI"]').click(); await P.settle();
    const scr = P.d.querySelector('.oscreen[data-order="oI"]'), words = t(scr);
    ok(!!scr && /Complete/.test(words) && !/import/i.test(words) && !/book/i.test(words), "C1: the customer reads Complete and no word of the import: " + words.slice(0, 300));
    const ag = scr && scr.querySelector('[data-part="again"] [data-again]');
    ok(!!ag, "C1: an imported order handed over in full offers Order again");
  } finally { pages.forEach((x) => x.close && x.close()); }
  const o = Object.assign({}, rawOrder, { msgs: [] });
  const d1 = decideCustomer(o, "say", { text: "Thank you" }, [o], AT);
  const ap = d1.ev && applyEvent(JSON.parse(JSON.stringify(o)), d1.ev).order;
  ok(!d1.error && ap && ap.msgs.length === 1 && ap.msgs[0].text === "Thank you" && ap.imported === true, "C2: a customer may write on an imported order: " + JSON.stringify(d1.error || ap && ap.msgs));
}
