import { richOwnerPage, byAct } from "./maker-act.mjs";

/* 21 Oct 2026, his word: Salt Admin's bar was bare. It says where he is (the place, the part under it) and carries what waits, as the Desk's
   bar does: Needs you, Orders and Customers, the rail's own figures, and Approve brass with the rows to approve; each chip goes to its place. */
export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork });
  try {
    await p.work.quiet();
    const d = p.d, txt = (id) => (d.getElementById(id) || {}).textContent;
    const tap = async (act) => { const e = byAct(d, act); if (e) e.click(); await p.work.quiet(); return !!e; };
    const bar = d.querySelector("header.abar"), chips = d.getElementById("aBarChips");
    ok(!!bar && !!chips && bar.contains(chips) && bar.contains(d.getElementById("aWhereView")), "Salt Admin's bar holds where he is and what waits");
    const n = (k) => { const c = chips.querySelector('[data-act="bar.' + k + '"] .salt-deskbar__n'); return c ? c.textContent : null; };
    const rail = (k) => { const c = d.querySelector('[data-count="' + k + '"]'); return (c && c.textContent) || "0"; };
    ok(["needs", "orders", "customers"].every((k) => n(k) === rail(k)),
      "Needs you, Orders and Customers carry the rail's own figures: " + JSON.stringify(["needs", "orders", "customers"].map((k) => [n(k), rail(k)])));
    const act = chips.querySelector('[data-act="bar.approve"]');
    ok(!!act && act.querySelector(".salt-deskbar__badge").textContent === "2" && !act.classList.contains("is-zero"),
      "Approve counts the rows to approve, a trip's rows as one: " + (act && act.textContent));
    ok(txt("aWhereView") === "Needs you" && txt("aWherePage") === "", "on Needs you the bar names the place and no part: " + JSON.stringify([txt("aWhereView"), txt("aWherePage")]));
    await tap("bar.approve");
    const on = d.querySelector('.aparts[data-place="orders"] [aria-selected="true"]');
    ok(!!on && on.getAttribute("data-part") === "approve", "a tap on Approve opens Orders > Approve: " + (on && on.getAttribute("data-part")));
    ok(txt("aWhereView") === "Orders" && txt("aWherePage") === "Approve", "and the bar follows: " + JSON.stringify([txt("aWhereView"), txt("aWherePage")]));
    await tap("bar.customers");
    ok(txt("aWhereView") === "Customers" && txt("aWherePage") === "Messages", "a tap on Customers opens its messages: " + JSON.stringify([txt("aWhereView"), txt("aWherePage")]));
    await tap("bar.needs");
    ok(txt("aWhereView") === "Needs you", "and Needs you goes back to Needs you: " + txt("aWhereView"));
  } finally { try { p.w.close(); } catch (e) { } }
}
