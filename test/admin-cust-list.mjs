/* test/admin-cust-list.mjs: SALT ADMIN CUSTOMERS, P1, THE ACCOUNTS LIST (25 Oct 2026; canvas Salt Admin Customers, his yes to Asks A to J). Each check is red
 * under its own mutation (test/admin-cust-list.mutations.json):
 *   1  an account is Needs you's card: the state word and its age on line one, the code (mono) and the username on line two, one way, the figure last
 *   2  the cards stand under To do, Pending and FYI: owed past its term, a refund, locked out, not sent and no account are To do; owed within term and not
 *      opened Pending; opened and the practice account FYI; within a group the largest sum first
 *   3  the figure is what they owe, and a refund he owes back is in ember
 *   4  the one way follows the state: Message for money owed, Send for a sign-in to send, Show for no account, Open (a ghost) for the rest
 *   5  a tap on the card opens the account; a tap on its way does not
 *   6  the filters are a text tab row: No account in place of No account yet, a count beside each word, the chosen one selected, an empty one dimmed
 *   7  an Insight leads: what is owed and how much past its term, what he owes back, the sign-ins waiting
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct, enter } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;
const ISO = "2026-10-10T08:00:00.000Z";

export async function run({ ok, pageWork }) {
  const extra = [
    { username: "rfnd-acct", code: "CX5-ZED", account: true, t: { owed: 0, toGet: 0, refund: 25, pend: 0 }, flag: "refund", seen: { opens: 2, last: ISO, how: "link" }, sent: ISO, issued: "2026-10-01" },
    { username: "owe2-acct", code: "CX6-ZED", account: true, t: { owed: 300, toGet: 0, refund: 0, pend: 0 }, flag: "owes", seen: { opens: 1, last: ISO, how: "link" }, sent: ISO, issued: "2026-10-01" },
    { username: "unop-acct", code: "CX7-ZED", account: true, t: { owed: 0, toGet: 0, refund: 0, pend: 0 }, flag: "clear", seen: { opens: 0 }, sent: ISO, issued: "2026-10-01" }
  ];
  const due = new Date(Date.now() - 3 * 86400000 - 3600000).toISOString().slice(0, 10), soon = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  const p = await richOwnerPage({ pageWork, sheetAnswer: (j) => ({ ...j, accounts: j.accounts.concat(extra) }),
    inputsAnswer: (j) => ({ ...j, catalog: { ...j.catalog, owedMoney: [{ party: "CX1-ZED", rm: 100, since: "2026-10-01", due, rows: [{ rid: "s1", key: "k1", product: "salt" }] },
      { party: "CX6-ZED", rm: 300, since: "2026-10-01", due: soon, rows: [{ rid: "s2", key: "k2", product: "salt" }] }], owedGoods: [] } }) });
  try {
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    await p.work.quiet();
    enter(d, "customers", "accounts"); await p.work.quiet();
    const card = (code) => [...d.querySelectorAll("#rlist [data-u]")].find((c) => t(c.querySelector(".need-who")) === code);
    const groupOf = (code) => { const c = card(code); return c ? c.closest(".ngroup").getAttribute("data-sev") : ""; };
    /* 1 */
    const shape = (c) => [...c.children].map((x) => x.classList.contains("nkind") ? "kind" : x.classList.contains("salt-action__body") ? "body" : x.classList.contains("salt-action__go") ? "go" : x.classList.contains("nfig") ? "fig" : x.className);
    const cards = [...d.querySelectorAll("#rlist [data-u]")];
    const one = card("CX1-ZED"), who = one && one.querySelector(".need-who"), u = one && one.querySelector(".need-u");
    ok(cards.length === 8 && cards.every((c) => c.classList.contains("ncard") && J(shape(c)) === J(["kind", "body", "go", "fig"])) && /^Owed · 3 d late$/.test(t(one.querySelector(".nkind")))
      && who.classList.contains("need-who--code") && !!u && t(u) === "abcd-efgh" && who.nextElementSibling === u && !!card("CX2-ZED").getAttribute("data-u") && t(card("CX2-ZED").querySelector(".need-u")) === card("CX2-ZED").getAttribute("data-u")
      && d.querySelector('.aparts[data-place="customers"]').classList.contains("salt-segment--tight"),
      "an account is Needs you's card, its state and age, the code and the username, one way and the figure: " + cards.length + " cards, " + t(one));
    /* 2 */
    const order = (sev) => [...d.querySelectorAll('#rlist .ngroup[data-sev="' + sev + '"] [data-u]')].map((c) => t(c.querySelector(".need-who")));
    ok(J(order("now")) === J(["CX1-ZED", "CX5-ZED", "CX2-ZED", "CX3-ZED", "CX4-ZED"]) && J(order("soon")) === J(["CX6-ZED", "CX7-ZED"]) && J(order("watch")) === J(["Practice account, open"])
      && J([...d.querySelectorAll("#rlist .ngroup .nsev")].map(t)) === J(["To do", "Pending", "FYI"]),
      "To do holds owed past term, the refund, no account, locked and not sent, the largest sum first; Pending owed within term and not opened; FYI the practice account: " + J([order("now"), order("soon"), order("watch")]));
    /* 3 */
    const fig = (code) => card(code).querySelector(".nfig");
    ok(t(fig("CX1-ZED")) === "RM 100" && t(fig("CX6-ZED")) === "RM 300" && t(fig("CX5-ZED")) === "RM 25" && fig("CX5-ZED").classList.contains("nfig--mine") && !fig("CX1-ZED").classList.contains("nfig--mine") && t(fig("CX3-ZED")) === "",
      "the figure is what they owe, a refund he owes back in ember, and none where nothing is owed: " + J(["CX1-ZED", "CX6-ZED", "CX5-ZED", "CX3-ZED"].map((c) => t(fig(c)))));
    /* 4 */
    const way = (code) => { const b = card(code).querySelector(".salt-action__go button"); return b ? t(b) + (b.classList.contains("salt-pill") ? "" : "/ghost") : ""; };
    ok(way("CX1-ZED") === "Message" && way("CX3-ZED") === "Send" && way("CX4-ZED") === "Send" && way("CX7-ZED") === "Send" && way("CX2-ZED") === "Show" && way("CX5-ZED") === "Open"
      && card("CX1-ZED").querySelectorAll(".salt-action__go button").length === 1,
      "the one way follows the state: Message, Send, Show, Open: " + J(["CX1-ZED", "CX3-ZED", "CX4-ZED", "CX7-ZED", "CX2-ZED", "CX5-ZED"].map(way)));
    /* 5 */
    await click(card("CX3-ZED").querySelector(".salt-action__go button"));
    const notOpened = d.getElementById("aopen").hidden;
    await click(card("CX7-ZED"));
    ok(notOpened && !d.getElementById("aopen").hidden && !!d.querySelector('#aopen [data-acct="unop-acct"]'),
      "a tap on the card opens the account, a tap on its way does not");
    /* 6 */
    const tabs = [...d.querySelectorAll("#afil button[data-f]")];
    const said = tabs.map((b) => b.firstChild.textContent + ":" + t(b.querySelector(".nktab__n")) + (b.disabled ? ":off" : ""));
    ok(tabs.every((b) => b.getAttribute("role") === "tab" && b.classList.contains("nktab") && b.classList.contains("salt-nav__link")) && d.getElementById("afil").getAttribute("role") === "tablist"
      && J(said) === J(["All:8", "Not sent:1", "Not opened:3", "They owe:2", "Locked out:1", "No account:1"]) && tabs[0].getAttribute("aria-selected") === "true",
      "the filters are a tab row, each with its count, No account in place of No account yet, All chosen: " + J(said));
    await click(tabs[3]);
    ok(tabs[3].getAttribute("aria-selected") === "true" && tabs[3].classList.contains("salt-nav__link--active") && tabs[0].getAttribute("aria-selected") === "false"
      && J([...d.querySelectorAll("#rlist [data-u]")].map((c) => t(c.querySelector(".need-who")))) === J(["CX1-ZED", "CX6-ZED"]),
      "a filter chosen is selected and narrows the cards");
    await click(tabs[0]);
    const q = await richOwnerPage({ pageWork, sheetAnswer: (j) => ({ ...j, accounts: j.accounts.filter((a) => !a.locked && a.account !== false) }) });
    try { await q.work.quiet(); enter(q.d, "customers", "accounts"); await q.work.quiet();
      const f = (k) => q.d.querySelector('#afil button[data-f="' + k + '"]');
      ok(!f("all").disabled && f("locked").disabled && f("none").disabled && !f("owes").disabled && !f("locked").hidden, "a filter with no account in its state is dimmed and cannot be chosen"); }
    finally { q.w.close(); }
    /* 7 */
    const lead = d.getElementById("alead");
    ok(!lead.hidden && lead.classList.contains("salt-insight") && t(lead) === "RM 400 is owed to you, RM 100 of it past its term; you owe RM 25 back. 2 accounts wait on a sign-in: 1 not sent, 1 locked out."
      && J([...lead.querySelectorAll("b")].map(t)) === J(["RM 400", "RM 25", "2 accounts"]),
      "an Insight leads: owed and past term, what he owes back, the sign-ins waiting: " + t(lead));
  } finally { p.w.close(); }
}
