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
    /* 22 Oct 2026, his canvas comment: where he is is not said on Salt Admin ("not required") */
    ok(!!bar && !!chips && bar.contains(chips) && !d.getElementById("aWhereView") && !bar.querySelector(".salt-deskbar__where"), "Salt Admin's bar holds what waits, and no where-you-are");
    const n = (k) => { const c = chips.querySelector('[data-act="bar.' + k + '"] .salt-deskbar__n'); return c ? c.textContent : null; };
    const rail = (k) => { const c = d.querySelector('[data-count="' + k + '"]'); return (c && c.textContent) || "0"; };
    ok(["needs", "orders", "customers"].every((k) => n(k) === rail(k)),
      "Needs you, Orders and Customers carry the rail's own figures: " + JSON.stringify(["needs", "orders", "customers"].map((k) => [n(k), rail(k)])));
    const act = chips.querySelector('[data-act="bar.approve"]');
    ok(!!act && act.querySelector(".salt-deskbar__badge").textContent === "2" && !act.classList.contains("is-zero"),
      "Approve counts the rows to approve, a trip's rows as one: " + (act && act.textContent));
    await tap("bar.approve");
    const on = d.querySelector('.aparts[data-place="orders"] [aria-selected="true"]');
    ok(!!on && on.getAttribute("data-part") === "approve", "a tap on Approve opens Orders > Approve: " + (on && on.getAttribute("data-part")));
    const partOn = (pl) => { const b = d.querySelector('.aparts[data-place="' + pl + '"] [aria-selected="true"]'); return b && b.getAttribute("data-part"); };
    const placeOn = () => { const b = d.querySelector('button[data-m][aria-current="page"]'); return b && b.getAttribute("data-m"); };
    await tap("bar.customers");
    ok(placeOn() === "customers" && partOn("customers") === "messages", "a tap on Customers opens its messages: " + JSON.stringify([placeOn(), partOn("customers")]));
    await tap("bar.needs");
    ok(placeOn() === "needs", "and Needs you goes back to Needs you: " + placeOn());
  } finally { try { p.w.close(); } catch (e) { } }
}
