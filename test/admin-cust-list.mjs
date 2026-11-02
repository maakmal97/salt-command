/* test/admin-cust-list.mjs: SALT ADMIN CUSTOMERS, P1, THE ACCOUNTS LIST (25 Oct 2026; canvas Salt Admin Customers, his yes to Asks A to J). Each check is red
 * under its own mutation (test/admin-cust-list.mutations.json):
 *   1  an account is a settings row (2 Nov 2026, his Customers canvas; Needs you's card from 25 Oct 2026): the code over the state word and its age, the figure,
 *      one way as a lit ghost, the username in the row's reading name
 *   2  the cards stand under To do, Pending and FYI: owed past its term, a refund, locked out, not sent and no account are To do; owed within term and not
 *      opened Pending; opened and the practice account FYI; within a group the largest sum first
 *   3  the figure is what they owe, and a refund he owes back is in ember
 *   4  the one way follows the state, each keeping its act: Message for money owed, Send for a sign-in to send, Show for no account, Open for the rest
 *   5  a tap on the row's text opens the account; a tap on its way does not
 *   6  the filters are a text tab row: No account in place of No account yet, a count beside each word, the chosen one selected, an empty one dimmed
 *   7  an Insight leads, one sentence: what is owed and how much of it is late, what he owes back, the sign-ins waiting
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
  const due = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10) /* 28 Oct 2026: the page's age is elapsed time from the due date's UTC midnight (ageOf), so a UTC date three days back reads 3 d at every hour; the 27 Oct Kuala Lumpur date read 2 d late from 16:00 to 24:00 UTC */, soon = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  const p = await richOwnerPage({ pageWork, sheetAnswer: (j) => ({ ...j, accounts: j.accounts.concat(extra) }),
    inputsAnswer: (j) => ({ ...j, catalog: { ...j.catalog, owedMoney: [{ party: "CX1-ZED", rm: 100, since: "2026-10-01", due, rows: [{ rid: "s1", key: "k1", product: "salt" }] },
      { party: "CX6-ZED", rm: 300, since: "2026-10-01", due: soon, rows: [{ rid: "s2", key: "k2", product: "salt" }] }], owedGoods: [] } }) });
  try {
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    await p.work.quiet();
    enter(d, "customers", "accounts"); await p.work.quiet();
    /* 2 Nov 2026 (Customers on the canvas): an account is a settings row, its code the .acode, its state the second line, its way a lit ghost, its sum the row's value */
    const rows = () => [...d.querySelectorAll("#rlist [data-u]")];
    const card = (code) => rows().find((c) => t(c.querySelector(".acode")) === code);
    const groupOf = (code) => { const c = card(code); return c ? c.closest("section").getAttribute("data-sev") : ""; };
    /* 1 */
    const shape = (c) => [...c.children].map((x) => x.classList.contains("arow__open") ? "open" : x.classList.contains("salt-settings__value") ? "value" : x.classList.contains("salt-ghost--lit") ? "move" : x.classList.contains("oask") ? "tail" : x.className);
    const cards = rows();
    const one = card("CX1-ZED"), open1 = one && one.querySelector(".arow__open");
    ok(cards.length === 8 && cards.every((c) => c.classList.contains("salt-settings__row") && c.classList.contains("arow") && c.firstElementChild.classList.contains("salt-settings__text") && !c.querySelector(".salt-pill")) && J(shape(one)) === J(["open", "value", "move", "tail"])
      && t(one.querySelector(".salt-settings__sub")) === "Owed · 3 d late" && one.querySelector(".salt-settings__sub").classList.contains("salt-settings__sub--late")
      && /abcd-efgh/.test(open1.getAttribute("aria-label")) && open1.querySelector(".salt-settings__label").firstElementChild === one.querySelector(".acode") && !!card("CX2-ZED").getAttribute("data-u")
      && d.querySelector('.aparts[data-place="customers"]').classList.contains("salt-segment--tight"),
      "an account is a settings row, its code over its state and age, its username in the reading name, one way and the figure: " + cards.length + " rows, " + t(one));
    /* 2 */
    const order = (sev) => [...d.querySelectorAll('#rlist section[data-sev="' + sev + '"] [data-u]')].map((c) => t(c.querySelector(".acode")));
    ok(J(order("now")) === J(["CX1-ZED", "CX5-ZED", "CX2-ZED", "CX3-ZED", "CX4-ZED"]) && J(order("soon")) === J(["CX6-ZED", "CX7-ZED"]) && J(order("watch")) === J(["Practice account, open"])
      && J([...d.querySelectorAll("#rlist section > h2.salt-settings__head")].map(t)) === J(["To do", "Pending", "FYI"]) && [...d.querySelectorAll("#rlist section")].every((s) => s.querySelectorAll(":scope > .salt-settings").length === 1),
      "To do holds owed past term, the refund, no account, locked and not sent, the largest sum first; Pending owed within term and not opened; FYI the practice account, each group one list under its head: " + J([order("now"), order("soon"), order("watch")]));
    /* 3 */
    const fig = (code) => card(code).querySelector(".salt-settings__value");
    ok(t(fig("CX1-ZED")) === "RM 100" && t(fig("CX6-ZED")) === "RM 300" && t(fig("CX5-ZED")) === "RM 25" && fig("CX5-ZED").classList.contains("nfig--mine") && !fig("CX1-ZED").classList.contains("nfig--mine") && t(fig("CX3-ZED")) === ""
      && fig("CX1-ZED").classList.contains("salt-settings__value--lg"),
      "the figure is what they owe, a refund he owes back in ember, and none where nothing is owed: " + J(["CX1-ZED", "CX6-ZED", "CX5-ZED", "CX3-ZED"].map((c) => t(fig(c)))));
    /* 4 */
    const way = (code) => { const b = card(code).querySelector(".salt-ghost--lit"); return b ? t(b) + "/" + b.getAttribute("data-act") : ""; };
    ok(J(["CX1-ZED", "CX3-ZED", "CX4-ZED", "CX7-ZED", "CX2-ZED", "CX5-ZED"].map(way)) === J(["Message/acct.message", "Send/need.signin-link", "Send/need.signin-link", "Send/need.signin-link", "Show/acct.show-link", "Open/acct.open-card"])
      && card("CX1-ZED").querySelectorAll("button").length === 1 && !card("CX1-ZED").querySelector(".salt-pill"),
      "the one way follows the state and keeps its act: Message, Send, Show, Open: " + J(["CX1-ZED", "CX3-ZED", "CX4-ZED", "CX7-ZED", "CX2-ZED", "CX5-ZED"].map(way)));
    /* 5 */
    await click(card("CX3-ZED").querySelector(".salt-ghost--lit"));
    const notOpened = d.getElementById("aopen").hidden;
    await click(card("CX7-ZED").querySelector('[data-act="acct.open"]'));
    ok(notOpened && !d.getElementById("aopen").hidden && !!d.querySelector('#aopen [data-acct="unop-acct"]'),
      "a tap on the row's text opens the account, a tap on its way does not");
    /* 6 */
    const tabs = [...d.querySelectorAll("#afil button[data-f]")];
    const said = tabs.map((b) => b.firstChild.textContent + ":" + t(b.querySelector(".nktab__n")) + (b.disabled ? ":off" : ""));
    ok(tabs.every((b) => b.getAttribute("role") === "tab" && b.classList.contains("nktab") && b.classList.contains("salt-nav__link")) && d.getElementById("afil").getAttribute("role") === "tablist"
      && J(said) === J(["All:8", "Not sent:1", "Not opened:3", "They owe:2", "Locked out:1", "No account:1"]) && tabs[0].getAttribute("aria-selected") === "true",
      "the filters are a tab row, each with its count, No account in place of No account yet, All chosen: " + J(said));
    await click(tabs[3]);
    ok(tabs[3].getAttribute("aria-selected") === "true" && tabs[3].classList.contains("salt-nav__link--active") && tabs[0].getAttribute("aria-selected") === "false"
      && J([...d.querySelectorAll("#rlist [data-u]")].map((c) => t(c.querySelector(".acode")))) === J(["CX1-ZED", "CX6-ZED"]),
      "a filter chosen is selected and narrows the rows");
    await click(tabs[0]);
    const q = await richOwnerPage({ pageWork, sheetAnswer: (j) => ({ ...j, accounts: j.accounts.filter((a) => !a.locked && a.account !== false) }) });
    try { await q.work.quiet(); enter(q.d, "customers", "accounts"); await q.work.quiet();
      const f = (k) => q.d.querySelector('#afil button[data-f="' + k + '"]');
      ok(!f("all").disabled && f("locked").disabled && f("none").disabled && !f("owes").disabled && !f("locked").hidden, "a filter with no account in its state is dimmed and cannot be chosen"); }
    finally { q.w.close(); }
    /* 7 */
    const lead = d.getElementById("alead");
    ok(!lead.hidden && lead.classList.contains("salt-insight") && t(lead) === "RM 400 is owed to you, RM 100 of it late; RM 25 owed back; 2 accounts await a sign-in."
      && J([...lead.querySelectorAll("b")].map(t)) === J(["RM 400", "RM 25", "2 accounts"]) && t(lead).split(/[.] /).length === 1 && t(lead).split(" ").length <= 20,
      "an Insight leads in one sentence: owed and late, what he owes back, the sign-ins waiting: " + t(lead));
  } finally { p.w.close(); }
}
