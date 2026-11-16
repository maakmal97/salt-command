/* test/admin-customers-v2.mjs: SALT ADMIN'S CUSTOMERS ON HIS CANVAS (2 Nov 2026; his words "beautiful and thoughtfully designed and consistent" and "accept all asks as
 * recommended"; the model is his Orders list of the same day). Display and markup only: no route, request body, price, booking or stored shape changes. What is
 * proved here, each check red under its own mutation (test/admin-customers-v2.mutations.json):
 *   C1  the parts are ONE Segment of exactly four tabs, Accounts, Messages, Links, Associates, each with its act, and the old addresses still land on them
 *   C2  below 1080px each group (To do, Pending, FYI) is one settings list under its own head: a row is the code over where it stands (copper when it waits on him,
 *       ember when late), the sum, and its one way as a lit ghost; no filled pill and no table
 *   C3  from 1080px one plain table with a colgroup and the rows class, a group head a row of it, the word cells left (never the Desk's unstyled l), the move in
 *       the table's act cell; no settings row beside it
 *   C4  a move keeps its act and what it posts or opens: Message opens their thread, Send makes the link, Show opens the guest list under the row, Open the account
 *   C5  nothing opens by itself and no empty pane stands beside the list: its column holds the list and the account's pane alone, and the table takes the width
 *   C6  the way back is one Orb, a chevron named for where it goes (All accounts, All forms), first in the open record, and it returns to the list or the menu;
 *       the open order has none of its own
 *   C7  the Accounts tab, tapped while an account is open, returns to the list
 *   C8  the lead over the list is one sentence, money first
 *   C9  every other table here is the rows table with its word columns left: Associates, and Their % beside the prices
 * Drawn by the maker harness (test/maker-act.mjs); the wide drawing answers matchMedia as a window of 1100px. */
import { richOwnerPage, byAct, enter } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;
const ISO = "2026-10-10T08:00:00.000Z";
const wideAt = (w) => { w.matchMedia = (q) => ({ matches: /min-width:\s*(860|1080)px/.test(q) && !/max-width/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }); };

export async function run({ ok, pageWork }) {
  const extra = [
    { username: "rfnd-acct", code: "CX5-ZED", account: true, t: { owed: 0, toGet: 0, refund: 25, pend: 0 }, flag: "refund", seen: { opens: 2, last: ISO, how: "link" }, sent: ISO, issued: "2026-10-01" },
    { username: "unop-acct", code: "CX7-ZED", account: true, t: { owed: 0, toGet: 0, refund: 0, pend: 0 }, flag: "clear", seen: { opens: 0 }, sent: ISO, issued: "2026-10-01" }
  ];
  const due = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  const preview = (code, book, whole) => ({ code, held: -0.1, pct: whole / 100, rows: [{ q: 1, now: 110, at: Math.max(60, 120 + whole), floor: 60, usual: true }] });
  const open = async (opts = {}) => {
    const p = await richOwnerPage({ pageWork, sheetAnswer: (j) => ({ ...j, accounts: j.accounts.concat(extra) }),
      inputsAnswer: (j) => ({ ...j, catalog: { ...j.catalog, products: [{ product: "salt", drift: true, saleReady: true }], driftCustomers: ["CX1-ZED"], partners: [], partnerWaiting: [],
        driftCards: [{ code: "CX1-ZED", product: "salt", held: true, value: -0.1, current: -0.1, suggest: -0.15, why: "good record" }],
        owedMoney: [{ party: "CX1-ZED", rm: 100, since: "2026-10-01", due, rows: [{ rid: "s1", key: "k1", product: "salt" }] }], owedGoods: [] } }),
      assocAnswer: (j) => ({ ...j, products: [{ product: "salt", rows: [{ id: "CX1-ZED", founder: true, rank: 1, bought: 10, soldFor: 5, introduced: 2, reward: { earned: 3, taken: 1, left: 1.4, next: 0.8 } }] }] }),
      extra: (route) => { const m = /^\/all\/maker\/drift-preview\/([A-Z0-9-]+)\/([a-z]+)\/(-?\d+)$/.exec(route); return m ? { ok: true, preview: preview(m[1], m[2], +m[3]) } : undefined; }, ...opts });
    await p.work.quiet();
    p.click = async (e) => { if (e) e.click(); await p.work.quiet(); await p.work.quiet(); };
    p.rowOf = (code) => [...p.d.querySelectorAll("#rlist [data-u]")].find((c) => t(c.querySelector(".acode")) === code);
    return p;
  };

  /* below 1080px */
  let p = await open();
  try {
    const d = p.d;
    enter(d, "customers", "accounts"); await p.work.quiet();
    /* C1 */
    const seg = d.querySelector('.aparts[data-place="customers"]'), tabs = seg ? [...seg.querySelectorAll('button[data-part]')] : [];
    /* 16 Nov 2026, the move to Ambient (place H): the parts are Ambient's Segment, a part pressed */
    ok(!!seg && seg.classList.contains("amb-segment") && !seg.classList.contains("amb-segment--wrap") && tabs.length === 4
      && tabs.map(t).join() === "Accounts,Messages,Links,Associates" && tabs.map((b) => b.getAttribute("data-act")).join() === "part.customers.accounts,part.customers.messages,part.customers.links,part.customers.associates"
      && tabs.every((b) => b.classList.contains("amb-segment__opt")),
    "the parts are one Segment of exactly four tabs in order, each with its act: " + tabs.map(t).join(" | "));
    /* C2 */
    const secs = [...d.querySelectorAll("#rlist section")], one = p.rowOf("CX1-ZED"), two = p.rowOf("CX2-ZED"), row = (c) => p.rowOf(c);
    const sub = (c) => row(c).querySelector(".amb-row__sub"), word = (c) => sub(c).firstElementChild;
    ok(secs.length === 3 && secs.every((s) => s.querySelectorAll(":scope > h2.amb-section").length === 1 && s.querySelectorAll(":scope > ul.amb-list").length === 1)
      && !d.querySelector("#rlist table") && !d.querySelector("#rlist .salt-pill") && !d.querySelector("#rlist .salt-glass-card") && [...d.querySelectorAll("#rlist .oask")].every((x) => x.hidden)
      && [...d.querySelectorAll("#rlist [data-u]")].every((r) => r.classList.contains("amb-row") && r.querySelectorAll(".amb-row__trail .amb-pill--sm").length === 1)
      && t(sub("CX1-ZED")) === "Owed, 3 d late, RM 100" && word("CX1-ZED").classList.contains("amb-neg") && word("CX2-ZED").classList.contains("amb-neg")
      && !word("CX7-ZED").classList.contains("amb-neg") && /^Not opened/.test(t(sub("CX7-ZED"))),
    "each group is one list under its head, a row's state word ember when it waits on him or is late, one small pill each and no salt pill: " + secs.map((s) => t(s.querySelector("h2"))).join());
    /* C4, below 1080px */
    await p.click(row("CX1-ZED").querySelector('[data-act="acct.message"]'));
    const thread = d.getElementById("makerChatOpen").getAttribute("data-key") === "abcd-efgh";
    enter(d, "customers", "accounts"); await p.work.quiet();
    p.posts.length = 0;
    await p.click(row("CX3-ZED").querySelector('[data-act="need.signin-link"]'));
    const made = p.posts.length;
    await p.click(row("CX2-ZED").querySelector('[data-act="acct.show-link"]'));
    const tail = row("CX2-ZED").nextElementSibling;
    await p.click(row("CX5-ZED").querySelector('[data-act="acct.open-card"]'));
    ok(thread && made > 0 && !!tail && !tail.hidden && t(tail).length > 0 && row("CX2-ZED").nextElementSibling === tail && !!d.querySelector('#aopen [data-acct="rfnd-acct"]'),
      "Message opens their thread, Send makes the link, Show answers under its row, Open opens the account: " + J([thread, made, t(tail)]));
    /* C6, the way back */
    const back = d.querySelector("#aopen > [data-back]");
    ok(!!back && back === d.getElementById("aopen").firstElementChild && back.tagName === "BUTTON" && back.classList.contains("amb-pill--quiet") && back.getAttribute("aria-label") === "All accounts"
      && back.getAttribute("data-back") === "accounts" && back.getAttribute("data-act") === "acct.back" && t(back) === "All accounts" && !!back.querySelector('svg use[href="#amb-back"]'),
    "the way back is a small quiet pill holding the system's back glyph, named All accounts, first in the open account: " + (back && back.outerHTML.slice(0, 160)));
    await p.click(back);
    ok(d.getElementById("aopen").hidden && !d.getElementById("oAccts").classList.contains("open"), "and it returns to the list");
    /* C7 */
    await p.click(row("CX5-ZED").querySelector('[data-act="acct.open"]'));
    const was = !d.getElementById("aopen").hidden;
    await p.click(byAct(d, "part.customers.accounts"));
    ok(was && d.getElementById("aopen").hidden && !d.getElementById("oAccts").classList.contains("open") && d.querySelector('.aparts[data-place="customers"] [aria-pressed="true"]').getAttribute("data-part") === "accounts",
      "the Accounts tab, tapped while an account is open, returns to the list");
    /* C6, Record's form and the open order */
    enter(d, "record", "entry"); await p.work.quiet();
    await p.click(byAct(d, "record.form", "sale-or-purchase"));
    const fb = d.getElementById("makerFormBack");
    ok(!!fb && fb.classList.contains("amb-circle") && fb.getAttribute("aria-label") === "All forms" && fb.getAttribute("data-back") === "form" && fb.getAttribute("data-act") === "record.form-back" && t(fb) === "" && !!fb.querySelector('svg use[href="#amb-back"]'),   /* 16 Nov 2026, the move to Ambient (place I): the way back is Ambient's circle */
      "Record's open form has the way back, a circle named All forms");
    await p.click(fb);
    ok(d.querySelector('#makerInputs [data-form="sale-or-purchase"]').hidden, "and it returns to the menu");
    ok(!d.querySelector("#makerReview [data-back]") && !byAct(d, "order.back"), "the open order draws no way back of its own, the rail's Orders closes it");
    /* C8 */
    enter(d, "customers", "accounts"); await p.work.quiet();
    const lead = d.getElementById("alead");
    ok(lead.classList.contains("amb-notice") && !/[.] /.test(t(lead)) && /[.]$/.test(t(lead)) && /^RM 100 is owed to you/.test(t(lead)) && t(lead).split(" ").length <= 20,
      "the lead is one sentence, money first, of twenty words at most: " + t(lead));
    /* C9, Their % and Associates */
    await p.click(p.rowOf("CX1-ZED").querySelector('[data-act="acct.open"]'));
    const pt = d.querySelector("#aopen table.apct__table");
    enter(d, "customers", "associates"); await p.work.quiet();
    const at = d.querySelector("#clist table.atable");
    const nums = (tb) => tb ? [...tb.querySelectorAll("thead th")].map((h) => h.classList.contains("is-num")) : [];
    ok(!!pt && pt.classList.contains("amb-table--stack") && !pt.closest(".salt-table-wrap") && J(nums(pt)) === J([false, true, true, true])
      && !!at && at.classList.contains("amb-table--stack") && !at.closest(".salt-table-wrap") && J(nums(at)) === J([false, false, true, true, true, true, true, true, false])
      && [...at.querySelectorAll("tbody td")].every((c) => c.hasAttribute("data-label")) && !d.querySelector("#oCustomers th.l, #oCustomers td.l"),
    "Their % and Associates are Ambient's tables, stacking where there is no room, their figures right, every cell labelled: " + J([nums(pt), nums(at)]));
  } catch (e) { ok(false, "admin-customers-v2 stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* the old addresses land on the parts */
  for (const [hash, part] of [["#accounts", "accounts"], ["#links", "links"], ["#cards", "associates"], ["#customers/messages", "messages"]]) {
    p = await open({ hash });
    try {
      const sel = p.d.querySelector('.aparts[data-place="customers"] [aria-pressed="true"]');
      ok(!!sel && sel.getAttribute("data-part") === part, "the address " + hash + " lands on " + part + ": " + (sel && sel.getAttribute("data-part")));
    } catch (e) { ok(false, "admin-customers-v2 stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
  }

  /* from 1080px: the same rows, the list and the account the system's two panes */
  p = await open({ before: wideAt });
  try {
    const d = p.d;
    enter(d, "customers", "accounts"); await p.work.quiet();
    /* C3: 16 Nov 2026, the move to Ambient (place H): there is no table of accounts; the rows stand in the first pane at every width, the account in the second */
    ok(!d.querySelector("#rlist table") && !d.querySelector("#rlist .salt-glass-card") && [...d.querySelectorAll("#rlist [data-u]")].every((r) => r.tagName === "LI" && r.classList.contains("amb-row")) && [...d.querySelectorAll("#rlist section > h2.amb-section")].map(t).join() === "To do,Pending,FYI",
    "wide, the accounts are the same rows under the same heads, no table");
    const r1 = d.querySelector('li[data-u="abcd-efgh"]'), cs = [...r1.children];
    ok(cs.length === 2 && cs[0].classList.contains("amb-row__main") && cs[0].getAttribute("data-act") === "acct.open" && cs[1].classList.contains("amb-row__trail") && /RM 100/.test(t(cs[0])) && !d.querySelector("#oCustomers th.l, #oCustomers td.l"),
    "a row is its text, which opens the account, and its move in the trail: " + cs.map(t).join(" | "));
    /* C4 */
    await p.click(r1.querySelector('[data-act="acct.message"]'));
    const thread = d.getElementById("makerChatOpen").getAttribute("data-key") === "abcd-efgh";
    enter(d, "customers", "accounts"); await p.work.quiet();
    p.posts.length = 0;
    await p.click(d.querySelector('#rlist li[data-u="tvwx-yz23"] [data-act="need.signin-link"]'));
    const made = p.posts.length;
    await p.click(d.querySelector('#rlist li[data-u="jkmn-pqrs"] [data-act="acct.show-link"]'));
    const tail = d.querySelector('#rlist li[data-u="jkmn-pqrs"] + li.oask');
    ok(thread && made > 0 && !!tail && !tail.hidden && t(tail).length > 0 && !!tail.querySelector(".amb-codeframe__field > img"), "wide too Message opens their thread, Send makes the link and Show answers in an item under its row, its code in the system's frame: " + J([thread, made, t(tail)]));
    /* C5 */
    ok(!d.querySelector("#oAccts .panenone") && J([...d.querySelector("#oAccts .asplit").children].map((c) => c.id)) === J(["rlist", "aside"]) && d.getElementById("aopen").hidden && !d.getElementById("anone").hidden
      && d.querySelector("#oAccts .asplit").classList.contains("amb-split--panes"),
      "the list and the account are the system's two panes; with nothing open the second says Choose an account");
    /* C6, wide the open account has its way back too (the layer hides it from 960px) */
    await p.click(d.querySelector('#rlist li[data-u="rfnd-acct"] [data-act="acct.open"]'));
    const back = d.querySelector("#aopen > [data-back]");
    ok(!!back && back.classList.contains("aback") && d.getElementById("anone").hidden, "the open account has the same way back, and the prompt goes");
    await p.click(back);
    ok(d.getElementById("aopen").hidden && !d.getElementById("anone").hidden && d.querySelectorAll("#rlist li[data-u]").length > 3, "and the list is there again");
  } catch (e) { ok(false, "admin-customers-v2 stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
}
