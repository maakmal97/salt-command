import { richOwnerPage, byAct } from "./maker-act.mjs";

/* 21 Oct 2026, his word: Salt Admin's bar was bare, so it carried what waits, as the Desk's bar does: Needs you, Orders and Customers, the
   rail's own figures, and Approve with the rows to approve. 15 Nov 2026, THE MOVE TO AMBIENT: the bar is gone with the salt-ds frame. What
   waits is on his places' tabs, Ambient's count (0.7.2) with the tab's name saying it ("Orders, 3 waiting"); Approve is Orders' one main
   action, in its hero, named with the rows. Each check is proved red by its own mutation (test/admin-bar-live.mutations.json).
   22 Nov 2026 (the place head, his answers of 22 Nov 2026): Approve is in every place's status row, never hidden, its count beside its word, 0 greyed when nothing waits. */
export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork });
  try {
    await p.work.quiet();
    const d = p.d;
    const tap = async (act) => { const e = byAct(d, act); if (e) e.click(); await p.work.quiet(); return !!e; };
    ok(!d.getElementById("aBarChips") && !d.querySelector("header.abar") && !d.querySelector(".salt-deskbar"), "Salt Admin has no bar of chips: what waits is on his tabs");
    const tab = (k) => d.querySelector('.amb-tabbar .place[data-m="' + k + '"]:not([data-p])');
    const said = (k) => { const t = tab(k), c = t && t.querySelector(".amb-tab__count"); return t && c ? [c.hidden ? "" : c.textContent, t.getAttribute("aria-label")] : null; };
    const fig = ["needs", "orders", "customers"].map((k) => [k, said(k)]);
    ok(fig.every(([k, s]) => s && (s[0] ? s[1] === tab(k).getAttribute("data-word") + ", " + s[0] + " waiting" : s[1] === tab(k).getAttribute("data-word")))
      && fig.some(([, s]) => s && +s[0] > 0) && ["record", "shop"].every((k) => { const c = tab(k).querySelector(".amb-tab__count"); return !c || (c.hidden && !c.textContent && tab(k).getAttribute("aria-label") === tab(k).getAttribute("data-word")); }),
      "Needs you, Orders and Customers carry their figures on their tabs, each tab named with what waits, and Record and Shop none: " + JSON.stringify(fig));
    /* 22 Nov 2026 (the place head): Approve stood in Orders' hero alone; it is now the status row's, on every place, named with the rows and saying their count */
    const PLACES = ["mHome", "oOrders", "oCustomers", "oRecord", "oShop"];
    const aps = PLACES.map((id) => d.querySelector("#" + id + " > .amb-head > .amb-status > .amb-status__end > button.amb-pill[data-approve][data-act='bar.approve']"));
    const ap = d.getElementById("aApprove"), cnt = (b) => b && b.querySelector("[data-approve-n]");
    ok(aps.every(Boolean) && d.querySelectorAll("[data-approve]").length === 5 && d.querySelectorAll('[id="aApprove"]').length === 1 && ap === aps[0] && !d.querySelector("header.amb-hero [data-approve]")
      && aps.every((b) => !b.hidden && b.getAttribute("aria-label") === "Approve, 2 to approve" && cnt(b).textContent === "2" && !cnt(b).hasAttribute("data-zero")),
      "Approve ends every place's status row, named with the rows to approve (a trip's rows as one) and saying their count, its id Needs you's alone: " + JSON.stringify(aps.map((b) => b && [b.hidden, b.getAttribute("aria-label"), cnt(b).textContent])));
    /* a tap from a place other than Orders: the same Approve is on all five */
    d.querySelector("#oCustomers [data-approve]").click(); await p.work.quiet();
    /* 2 Nov 2026 (Orders on the canvas): Approve has no tab in the Segment, so it is open when its own section is in view and the list is shut */
    const inView = (el) => { for (let e = el; e && e.id !== "roster"; e = e.parentElement) if (e.hidden) return false; return !!el; };
    ok(inView(d.getElementById("oApprove")) && !inView(d.getElementById("oSplit")) && d.querySelector('.place[data-m="orders"][aria-current="page"]') !== null && p.w.location.hash === "#orders/approve",
      "a tap on Approve, on Customers, opens Orders > Approve: " + p.w.location.hash);
    const placeOn = () => { const b = d.querySelector('button[data-m][aria-current="page"]'); return b && b.getAttribute("data-m"); };
    await tap("nav.customers");
    ok(placeOn() === "customers", "a tap on the Customers tab opens Customers: " + placeOn());
    await tap("nav.needs");
    ok(placeOn() === "needs", "and Needs you's tab goes back to Needs you: " + placeOn());
  } finally { try { p.w.close(); } catch (e) { } }
  /* 22 Nov 2026 (the place head): with nothing to approve Approve stays, on every place, named plain and counting 0, greyed (data-zero) */
  const q = await richOwnerPage({ pageWork, review: (j) => Object.assign({}, j, { drafts: [] }) });
  try {
    await q.work.quiet();
    const all = [...q.d.querySelectorAll("[data-approve]")], n = (b) => b.querySelector("[data-approve-n]");
    ok(all.length === 5 && all.every((b) => !b.hidden && b.getAttribute("aria-label") === "Approve" && n(b).textContent === "0" && n(b).hasAttribute("data-zero")),
      "and with no rows waiting it is never hidden: it reads Approve and 0, greyed, on every place: " + JSON.stringify(all.map((b) => [b.hidden, b.getAttribute("aria-label"), n(b).textContent])));
  } finally { try { q.w.close(); } catch (e) { } }
}
