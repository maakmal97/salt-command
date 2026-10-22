/* test/admin-needs-groups.mjs: SALT ADMIN NEEDS YOU, P4 (22 Oct 2026; his canvas Needs you and his names). What is proved here, each check red under its
 * own mutation (test/admin-needs-groups.mutations.json):
 *   1  the cards stand in three groups, To do, Pending and FYI, in that order, each a section with its one word for a heading, always open, no count
 *      and no fold; a practice card stays in its own folded line at the foot
 *   2  his own work is To do (a payment, an order, a message, an account, a link, an entry, goods paid for and not handed over, a step to send again);
 *      Pending is the customer's (money owed past its term, an offer of his waiting on their yes); FYI is what needs nothing (a notice, an override)
 *   3  within a group money comes first, the largest sum first, then the cards with no sum, the oldest first
 *   4  an offer waiting on their yes is one Pending card whose Withdraw asks once on the card: Cancel sends nothing, Yes sends the order card's own
 *      withdraw with a request id; an offer they have taken draws no card (it waits under Approve)
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;
const OWED = { party: "CX9-ZED", rm: 120, since: "2026-10-01", due: "2026-10-08", rows: [{ rid: "s-owed-1", key: "k1", product: "salt" }] };
const GOODS = { rid: "s-goods-1", party: "CX8-ZED", product: "salt", units: 2, date: "2026-10-02", key: "k2" };

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork, inputsAnswer: (j) => ({ ...j, catalog: { ...j.catalog, owedMoney: [OWED], owedGoods: [GOODS] } }) });
  try {
    await p.work.quiet();
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    await click(byAct(d, "nav.needs"));
    /* 1 */
    const groups = [...d.querySelectorAll("#nlist > *")].filter((g) => g.matches("section, details"));
    const heads = groups.map((g) => [g.tagName, g.getAttribute("data-sev"), t(g.querySelector(":scope > .nsev")), g.getAttribute("aria-label")]);
    ok(J(heads.filter((h) => h[1] !== "practice")) === J([["SECTION", "now", "To do", "To do"], ["SECTION", "soon", "Pending", "Pending"], ["SECTION", "watch", "FYI", "FYI"]])
      && groups.every((g) => g.querySelector(":scope > .nsev").tagName === (g.tagName === "SECTION" ? "H2" : "SUMMARY")) && !d.querySelector('#nlist details[data-sev="soon"], #nlist details[data-sev="watch"]'),
      "three groups, To do, Pending and FYI, each a section headed by its one word with no count, none folded: " + J(heads));
    /* 2 */
    const sevOf = (key) => { const c = d.querySelector('#nlist [data-need="' + key + '"]'); return c ? c.closest("[data-sev]").getAttribute("data-sev") : null; };
    const want = { "p:ord-a1": "now", "o:ord-p1": "now", "m:abcd-efgh": "now", "s": "now", "l:w1": "now", "x:0": "now", "q:q-2": "now", "a:ord-a2": "now", "n:jkmn-pqrs": "now",
      "u:/all/maker/inputs/loan": "now", "g:s-goods-1": "now", "$:CX9-ZED": "soon", "f:ord-p4": "soon", "w:notice": "watch" };
    const got = Object.fromEntries(Object.keys(want).map((k) => [k, sevOf(k)]));
    ok(J(got) === J(want), "his own work is To do, what the customer owes or must answer is Pending, and a notice is FYI: " + J(got));
    /* 3 */
    const todo = [...d.querySelectorAll('#nlist section[data-sev="now"] [data-need]')].map((c) => c.getAttribute("data-need"));
    const money = todo.slice(0, 6), rest = todo.slice(6);
    ok(J(money) === J(["p:ord-a1", "o:ord-p1", "o:ord-p2", "o:ord-p3", "c:abcd-efgh:c-1", "c:abcd-efgh:c-2"]) && J(rest.slice(0, 2)) === J(["s", "g:s-goods-1"]) && rest.indexOf("n:jkmn-pqrs") > rest.indexOf("m:abcd-efgh"),
      "money first, the largest sum first (RM 530, 200, 100, 100, 50, 20), then the cards with no sum, the oldest first (the sign-ins ready since 01 Oct, then the goods ordered 02 Oct): " + J(todo));
    /* 4 */
    const offer = () => d.querySelector('#nlist [data-need="f:ord-p4"]');
    const posts = () => p.wire.filter((x) => /\/all\/maker\/orders\/ord-p4\/withdraw/.test(x)).length;
    ok(!!offer() && t(offer().querySelector(".salt-action__kind")).startsWith("Offer") && !!byAct(offer(), "need.withdraw") && t(byAct(offer(), "need.withdraw")) === "Withdraw"
      && !d.querySelector('#nlist [data-need="o:ord-p4"]'), "an offer waiting on their yes is one Pending card with Withdraw, and no Agree card");
    await click(byAct(offer(), "need.withdraw"));
    ok(/^Take back your offer of RM [0-9,.]+ to CX1-ZED\?$/.test(t(offer().querySelector(".nask"))) && posts() === 0, "Withdraw asks once on the card and sends nothing yet: " + t(offer().querySelector(".nask")));
    await click(byAct(offer(), "need.ask-no"));
    ok(!offer().querySelector(".nask") && posts() === 0, "Cancel sends nothing");
    await click(byAct(offer(), "need.withdraw"));
    await click(byAct(offer(), "need.ask-yes"));
    const sent = p.posts.filter((x) => /\/all\/maker\/orders\/ord-p4\/withdraw$/.test(x.route));
    ok(sent.length === 1 && /^[0-9a-f]{32}$/.test(sent[0].body.rid) && J(Object.keys(sent[0].body)) === J(["rid"]), "Yes sends the order card's own withdraw, once, with its request id: " + J(sent.map((x) => x.body)));
  } finally { p.w.close(); }

  /* 4b: an offer they have taken waits under Approve and draws no card */
  const q = await richOwnerPage({ pageWork, review: (j) => ({ ...j, orders: (j.orders || []).map((o) => (o.id === "ord-p4" ? { ...o, price: { ...o.price, state: "taken" } } : o)) }) });
  try {
    await q.work.quiet();
    byAct(q.d, "nav.needs").click(); await q.work.quiet();
    ok(!q.d.querySelector('#nlist [data-need="f:ord-p4"]') && !q.d.querySelector('#nlist [data-need="o:ord-p4"]'), "an offer they have taken draws no card on Needs you");
  } finally { q.w.close(); }
}
