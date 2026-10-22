/* test/admin-ac-fee.mjs: THE DELIVERY CHARGE (SALT ADMIN A TO C, P9, 21 Oct 2026; docs/plan-counter-admin-ac.html), RE-AIMED ON 22 Oct 2026 when the slider of
 * four radios became ONE select beside Goods (his canvas Needs you). What is proved here, each check red under its own mutation (test/admin-ac-fee.mutations.json):
 *   1  a delivery's charge is one select, act order.fee, labelled Delivery, RM, its options in order Choose, 0, 10, 15 and Other; Choose is selected and
 *      NOTHING is chosen until he chooses, and Other's field is shut
 *   2  a charge chosen is the option selected, and no other; Other opens its field and the others shut it
 *   3  the charge chosen is the one the figures are read at
 *   4  the select stands in the Agree grid beside Goods, as a field the system draws at the full width of its column */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const J = JSON.stringify;

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork });
  try {
    await p.work.quiet();
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    await click(byAct(d, "nav.orders")); await click(byAct(d, "part.orders.placed"));
    await click(byAct(d, "order.open", "ord-p2"));
    const sel = byAct(d, "order.fee", "ord-p2"), opts = sel ? [...sel.options] : [];
    const read = () => ({ value: sel.value, on: opts.map((o) => o.selected ? 1 : 0).join("") });
    /* 1 */
    ok(!!sel && sel.tagName === "SELECT" && sel.closest("label").querySelector(".lbl").textContent === "Delivery, RM"
      && J(opts.map((o) => [o.value, o.textContent])) === J([["", "Choose"], ["0", "0"], ["10", "10"], ["15", "15"], ["other", "Other"]])
      && read().value === "" && read().on === "10000",
      "a delivery's charge is one select, its options Choose, 0, 10, 15 and Other, Choose selected while none is chosen: " + J(sel && read()));
    /* 2 */
    const other = byAct(d, "order.fee-other-amount", "ord-p2"), shut = () => other.closest("label").hidden;
    const pick = async (v) => { sel.value = v; sel.dispatchEvent(new d.defaultView.Event("change", { bubbles: true })); await p.work.quiet(); };
    ok(shut(), "Other's field is shut while no charge is chosen");
    await pick("15");
    const r15 = read();
    ok(J(r15) === J({ value: "15", on: "00010" }) && shut(), "RM 15 chosen is the option selected, Other's field shut: " + J(r15));
    await pick("other");
    ok(J(read()) === J({ value: "other", on: "00001" }) && !shut(), "Other is the option selected and opens its field: " + J(read()));
    /* 3 */
    p.posts.length = 0;
    await pick("10");
    const pv = p.posts.filter((x) => /\/preview$/.test(x.route)).pop();
    ok(J(read()) === J({ value: "10", on: "00100" }) && shut() && !!pv && pv.body.delivery === 10,
      "RM 10 shuts Other's field again, and the figures are read at RM 10: " + J(pv && pv.body));
    /* 4 */
    const grid = sel.closest(".oagree"), css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(!!grid && grid.classList.contains("maker-fields") && sel.classList.contains("salt-field__select") && sel.classList.contains("salt-field__input")
      && /\.adm \.oagree \.salt-field__input\{width:100%;min-width:0;box-sizing:border-box\}/.test(css),
      "the select stands in the Agree grid as the system's select, filling its column");
  } finally { p.w.close(); }
}
