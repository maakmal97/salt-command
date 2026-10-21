/* test/admin-ac-fee.mjs: SALT ADMIN A TO C, P9 (21 Oct 2026; docs/plan-counter-admin-ac.html). What is proved here, each check red under its own
 * mutation (test/admin-ac-fee.mutations.json):
 *   1  a delivery's charge is the system's slider: a radiogroup of four options, RM 0, 10, 15 and Other, the same radios, names, values and acts,
 *      under the Delivery legend; none chosen until he chooses, and no thumb drawn while none is
 *   2  a charge chosen moves the thumb behind it alone; Other opens its field and the others shut it
 *   3  the charge chosen is the one the figures are read at
 *   4  an option is laid out as a block the system's 44px reaches, its focus shown on the option, and the waiting thumb hidden */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const J = JSON.stringify;

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork });
  try {
    await p.work.quiet();
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    await click(byAct(d, "nav.orders")); await click(byAct(d, "part.orders.placed"));
    await click(byAct(d, "order.open", "ord-p2"));
    const seg = d.querySelector("#makerReview .ofee"), opts = seg ? [...seg.children] : [];
    const radios = opts.map((l) => l.querySelector('input[type="radio"]'));
    const read = () => ({ on: opts.map((l) => l.classList.contains("salt-segment__opt--active") ? 1 : 0).join(""), i: seg.style.getPropertyValue("--i"), n: seg.style.getPropertyValue("--n"), none: seg.classList.contains("ofee--none") });
    /* 1 */
    ok(!!seg && seg.classList.contains("salt-segment") && seg.getAttribute("role") === "radiogroup" && seg.closest("fieldset").querySelector("legend").textContent === "Delivery"
      && J(opts.map((l) => [l.tagName, l.className, l.textContent])) === J([["LABEL", "salt-segment__opt", "RM 0"], ["LABEL", "salt-segment__opt", "RM 10"], ["LABEL", "salt-segment__opt", "RM 15"], ["LABEL", "salt-segment__opt", "Other"]])
      && J(radios.map((r) => [r.name, r.value, r.getAttribute("data-act")])) === J(["0", "10", "15", "other"].map((v) => ["makerFee-ord-p2", v, "order.fee-" + v]))
      && radios.every((r) => !r.checked) && read().none && read().on === "0000",
      "a delivery's charge is the system's slider, four options over the same radios, names, values and acts, none chosen and no thumb drawn: " + J(read()));
    /* 2 */
    const other = byAct(d, "order.fee-other-amount", "ord-p2"), shut = () => other.closest("label").hidden;
    await click(byAct(d, "order.fee-15", "ord-p2"));
    const r15 = read();
    ok(J(r15) === J({ on: "0010", i: "2", n: "4", none: false }) && shut(), "RM 15 chosen moves the thumb behind it alone, Other's field shut: " + J(r15));
    await click(byAct(d, "order.fee-other", "ord-p2"));
    ok(J(read()) === J({ on: "0001", i: "3", n: "4", none: false }) && !shut(), "Other moves it to the last and opens its field: " + J(read()));
    /* 3 */
    p.posts.length = 0;
    await click(byAct(d, "order.fee-10", "ord-p2"));
    const pv = p.posts.filter((x) => /\/preview$/.test(x.route)).pop();
    ok(J(read()) === J({ on: "0100", i: "1", n: "4", none: false }) && shut() && !!pv && pv.body.delivery === 10,
      "RM 10 shuts Other's field again, and the figures are read at RM 10: " + J(pv && pv.body));
    /* 4 */
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(/\.adm \.ofee \.salt-segment__opt\{display:flex;align-items:center;justify-content:center\}/.test(css) && /\.adm \.ofee \.salt-segment__opt:focus-within\{outline:2px solid var\(--salt-brass\)/.test(css)
      && /\.adm \.ofee--none::before\{display:none\}/.test(css) && radios.every((r) => r.classList.contains("sr")),
      "an option is a block the slider's 44px reaches, its focus drawn on the option, the radio itself for a reader, and the thumb hidden while none is chosen");
  } finally { p.w.close(); }
}
