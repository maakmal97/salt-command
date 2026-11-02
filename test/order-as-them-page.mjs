/* test/order-as-them-page.mjs: v1377, ORDER AS THEM ON THE PAGE (his answers A and D of 02 Nov 2026, plan parts 1b and 1c). Salt Admin's
 * Order for them opens the customer's own page by the master, as View as them does, with ordering live: Orders says he is ordering for
 * them and offers New order; the sheet has no note and no Negotiate; Place goes to /all/maker/customers/<u>/orders with their list's own
 * total and stamp, never to their /orders; Pay stays off. View as them stays read only. The old box of his own is gone. Every username
 * and figure is invented. */
import { richOwnerPage, byAct, enter } from "./maker-act.mjs";
import * as C from "../tools/stmt-crypto.mjs";

const U1 = "abcd-efgh";

export async function run({ ok, pageWork }) {
  const placed = { id: "20261102120000-oath", u: U1, at: "2026-11-02T04:00:00.000Z", status: "placed", product: "salt", qty: 1, mode: "collect", total: 100,
    unit: 100, paid: 0, payments: [], moved: 0, history: [{ at: "2026-11-02T04:00:00.000Z", status: "placed", by: "desk" }], msgs: [] };
  /* their account as /open answers his master: the statement, their sealed list and the master's wrap */
  const ck = await C.contentKey("order-as-them-secret", U1);
  const list = { at: "2026-11-02T00:00:00.000Z", week: { monday: "2026-10-27", label: "This week" }, soon: [], digest: "as-them-list",
    products: [{ product: "salt", unit: "unit", basis: "tier", sizes: [{ q: 1, price: 100 }, { q: 5, price: 450 }] }] };
  const opened = { ok: true, byMaster: true, session: "", assoc: false, card: null, wrapMaster: await C.wrapKey("fixture-master", ck),
    env: await C.encryptWith(ck, JSON.stringify({ statements: [{ issued: "2026-11-01", label: "November", body: "<p>Statement</p>" }] })),
    prices: Object.assign({ at: list.at, week: list.week.monday, digest: list.digest }, await C.encryptWith(ck, JSON.stringify(list))) };
  const extra = (route) => route === "/open" ? opened
    : route === "/all/maker/customers/" + U1 + "/orders" ? { ok: true, order: placed }
    : route === "/all/orders/" + U1 ? { ok: true, orders: [placed], claims: [], links: [], max: 0 } : undefined;
  const openAs = async (p, act) => {
    enter(p.d, "customers", "accounts"); await p.work.quiet();
    byAct(p.d, "acct.open", U1).click(); await p.work.quiet();
    byAct(p.d.getElementById("aopen"), act).click(); await p.work.quiet();
    const tab = p.d.querySelector('[data-t="order"]'); if (tab) { tab.click(); await p.work.quiet(); }
  };
  const lead = (p) => [...p.d.querySelectorAll("#pOrder .lead")].map((n) => n.textContent).join(" | ");

  /* B1 to B4: Order for them */
  let p = await richOwnerPage({ pageWork, extra });
  try {
    await openAs(p, "acct.order-for");
    const nb = p.d.getElementById("oNew");
    ok(/Placed for you/.test(p.d.getElementById("pOrder").textContent),
      "B6 an order he placed says Placed for you on its card, on their own page");
    ok(!!nb && /ordering for them/.test(lead(p)) && !p.d.getElementById("makerFor"),
      "B1 Order for them opens their own page with New order and says he is ordering for them; the old box is gone: " + JSON.stringify([!!nb, lead(p)]));
    nb.click(); await p.work.quiet();
    ok(!p.d.getElementById("oAddNote") && !p.d.getElementById("oSay"), "B2 the sheet has no note on Order as them");
    const go = p.d.getElementById("oGo");
    go.click(); await p.work.quiet();
    ok(!p.d.getElementById("oAskGo") && !!p.d.getElementById("oPlace"), "B3 the check offers Place and no Negotiate");
    const before = p.posts.length;
    p.d.getElementById("oPlace").click(); await p.work.quiet();
    const sent = p.posts.slice(before);
    const mine = sent.filter((x) => x.route === "/all/maker/customers/" + U1 + "/orders"), theirs = sent.filter((x) => x.route === "/orders");
    const b = mine[0] && mine[0].body;
    ok(mine.length === 1 && !theirs.length && !!b && !("note" in b) && b.digest === "as-them-list" && b.product === "salt" && b.total > 0 && /^[A-Za-z0-9_-]{16,}$/.test(b.rid || ""),
      "B4 Place goes through his route with their list's total and stamp and no note, never their /orders: " + JSON.stringify(sent.map((x) => [x.route, x.body])));
  } catch (e) { ok(false, "Order as them stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* B5: View as them stays read only */
  p = await richOwnerPage({ pageWork, extra });
  try {
    await openAs(p, "acct.view-as");
    ok(!p.d.getElementById("oNew") && /Read only/.test(lead(p)), "B5 View as them stays read only: no New order, the read-only line: " + lead(p));
  } catch (e) { ok(false, "View as them stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* B7: Salt Admin's Orders row of an order he placed, still placed, says You placed */
  p = await richOwnerPage({ pageWork, extra, review: (j) => Object.assign({}, j, { orders: j.orders.concat([placed]) }) });
  try {
    enter(p.d, "orders", "todo"); await p.work.quiet();
    ok(/You placed/.test(p.d.getElementById("oSplit").textContent), "B7 his Orders row of an order he placed says You placed");
  } catch (e) { ok(false, "his Orders stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
}
