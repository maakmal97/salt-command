/* test/admin-ac-again.mjs: SALT ADMIN A TO C, P6 (20 Oct 2026; docs/plan-counter-admin-ac.html, Ask 1). Order again's tag.
 * What is proved here, each check red under its own mutation (test/admin-ac-again.mutations.json):
 *   1  Place keeps againOf only when it names one of the account's own orders, done and owing nothing; one not done, one owing, one
 *      of nobody's are dropped without a word, and Place is not refused for it
 *   2  on his Orders list the row carries the brass Again pill and "<ref> again", and the order's band names the source the same way
 * The page's half (Order again sends the source's id, a fresh sheet none) is test/counter-b-again.mjs. Drawn by the maker harness. */
import { decidePlace } from "../stmt/orders.js";
import { richOwnerPage, byAct } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");

export async function run({ ok, pageWork }) {
  /* 1 */
  const at = new Date().toISOString(), body = (againOf) => ({ product: "salt", qty: 1, mode: "collect", unit: 100, total: 100, againOf });
  const D = { id: "d-done", u: "abcd-efgh", status: "done", total: 100, delivery: 0, paid: 100, qty: 1, product: "salt" };
  const R = { id: "d-ready", u: "abcd-efgh", status: "ready", total: 100, delivery: 0, paid: 100, qty: 1, product: "salt" };
  const W = { id: "d-owing", u: "abcd-efgh", status: "done", total: 100, delivery: 10, paid: 100, qty: 1, product: "salt" };
  const tag = (b) => { const r = decidePlace("abcd-efgh", b, [], at, "", "customer", null, { mine: [D, R, W] }); return r.error ? "refused: " + r.error : r.ev.order.againOf || null; };
  const got = [tag(body("d-done")), tag(body("d-ready")), tag(body("d-owing")), tag(body("d-nobody")), tag(body(undefined))];
  ok(JSON.stringify(got) === JSON.stringify(["d-done", null, null, null, null]), "Place keeps the tag only for a done order of theirs owing nothing, and drops any other without refusing: " + JSON.stringify(got));
  /* 2 */
  const base = { u: "abcd-efgh", product: "salt", msgs: [], history: [], payments: [], paid: 0, qty: 1, total: 100, delivery: 0, mode: "collect", at: "2026-10-10T02:00:00.000Z" };
  const extra = [{ ...base, id: "ord-g1", status: "placed", againOf: "ord-g0" }, { ...base, id: "ord-g2", status: "placed" }];
  const p = await richOwnerPage({ pageWork, review: (j) => ({ ...j, orders: (j.orders || []).concat(extra) }) });
  try {
    await p.work.quiet();
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    await click(byAct(d, "nav.orders")); await click(byAct(d, "part.orders.placed"));
    const row = d.querySelector('#makerOrderList [data-order="ord-g1"]'), plain = d.querySelector('#makerOrderList [data-order="ord-g2"]');
    const note = (r) => r && r.querySelector(".onote");
    ok(!!row && /^[A-Z0-9]{4}-[A-Z0-9]{3} again$/.test(t(note(row))) && note(row).classList.contains("onote--why") && !!plain && !/again/i.test(t(plain)),
      "his Orders row says the source's reference and again, in copper, and an order placed afresh neither: " + t(row));
    await click(byAct(d, "order.open", "ord-g1"));
    const ag = p.card("ord-g1") && p.card("ord-g1").querySelector(".ohead [data-again]");
    ok(!!ag && /^Again ?[A-Z0-9]{4}-[A-Z0-9]{3} again$/.test(t(ag)), "and its band names the order it was placed again from: " + t(ag));
  } finally { p.w.close(); }
}
