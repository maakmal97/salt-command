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
import { landingPage } from "../stmt/page.js";
import { FONT_FACE_CSS, STATEMENT_CSS, SITE_RECIPES } from "../stmt/statement-css.js";
import { JSDOM } from "jsdom";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;
const ISO = "2026-10-10T08:00:00.000Z";
const wideAt = (w) => { w.matchMedia = (q) => ({ matches: /min-width:\s*(860|1080)px/.test(q) && !/max-width/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }); };

function pageRules() {
  const html = landingPage("", "cust2-nonce", { master: "fixture-master", accounts: [] });
  const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [, ""])[1].slice((FONT_FACE_CSS + STATEMENT_CSS + SITE_RECIPES).length);
  const sheet = new JSDOM("<style>" + css + "</style>").window.document.styleSheets[0];
  const out = [];
  const walk = (rules, media) => { for (const r of rules) { if (r.selectorText) out.push([media + r.selectorText, r.style]); if (r.cssRules) walk(r.cssRules, r.conditionText ? "@" + r.conditionText + " " : media); } };
  walk(sheet.cssRules, "");
  return out;
}

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
    const seg = d.querySelector('.aparts[data-place="customers"]'), tabs = seg ? [...seg.querySelectorAll('[role="tab"]')] : [];
    ok(!!seg && seg.classList.contains("salt-segment") && seg.classList.contains("salt-segment--tight") && seg.style.getPropertyValue("--n") === "4" && tabs.length === 4
      && tabs.map(t).join() === "Accounts,Messages,Links,Associates" && tabs.map((b) => b.getAttribute("data-act")).join() === "part.customers.accounts,part.customers.messages,part.customers.links,part.customers.associates"
      && tabs.every((b) => b.classList.contains("salt-segment__opt")),
    "the parts are one Segment of exactly four tabs in order, each with its act: " + tabs.map(t).join(" | "));
    /* C2 */
    const secs = [...d.querySelectorAll("#rlist section")], one = p.rowOf("CX1-ZED"), two = p.rowOf("CX2-ZED"), row = (c) => p.rowOf(c);
    const sub = (c) => row(c).querySelector(".salt-settings__sub");
    ok(secs.length === 3 && secs.every((s) => s.querySelectorAll(":scope > h2.salt-settings__head").length === 1 && s.querySelectorAll(":scope > .salt-settings").length === 1)
      && !d.querySelector("#rlist table") && !d.querySelector("#rlist .salt-pill") && !d.querySelector("#rlist .salt-glass-card") && [...d.querySelectorAll("#rlist .oask")].every((x) => x.hidden)
      && [...d.querySelectorAll("#rlist [data-u]")].every((r) => r.classList.contains("salt-settings__row") && r.querySelectorAll(".salt-ghost--lit.salt-ghost--tight").length === 1)
      && t(sub("CX1-ZED")) === "Owed · 3 d late" && sub("CX1-ZED").classList.contains("salt-settings__sub--late") && sub("CX2-ZED").classList.contains("salt-settings__sub--why")
      && !sub("CX7-ZED").classList.contains("salt-settings__sub--why") && !sub("CX7-ZED").classList.contains("salt-settings__sub--late") && /^Not opened/.test(t(sub("CX7-ZED"))),
    "below 1080px each group is one settings list under its head, a row's second line copper when it waits on him and ember when late, one lit ghost each and no pill: " + secs.map((s) => t(s.querySelector("h2"))).join());
    /* C4, below 1080px */
    await p.click(row("CX1-ZED").querySelector('[data-act="acct.message"]'));
    const thread = d.getElementById("makerChatOpen").getAttribute("data-key") === "abcd-efgh";
    enter(d, "customers", "accounts"); await p.work.quiet();
    p.posts.length = 0;
    await p.click(row("CX3-ZED").querySelector('[data-act="need.signin-link"]'));
    const made = p.posts.length;
    await p.click(row("CX2-ZED").querySelector('[data-act="acct.show-link"]'));
    const tail = row("CX2-ZED").querySelector(".oask");
    await p.click(row("CX5-ZED").querySelector('[data-act="acct.open-card"]'));
    ok(thread && made > 0 && !!tail && !tail.hidden && t(tail).length > 0 && row("CX2-ZED").classList.contains("arow--ask") && !!d.querySelector('#aopen [data-acct="rfnd-acct"]'),
      "Message opens their thread, Send makes the link, Show answers under its row, Open opens the account: " + J([thread, made, t(tail)]));
    /* C6, the way back */
    const back = d.querySelector("#aopen > [data-back]");
    ok(!!back && back === d.getElementById("aopen").firstElementChild && back.tagName === "BUTTON" && back.classList.contains("salt-orb") && back.getAttribute("aria-label") === "All accounts"
      && back.getAttribute("data-back") === "accounts" && back.getAttribute("data-act") === "acct.back" && t(back) === "" && !!back.querySelector('svg[aria-hidden="true"] path') && !d.querySelector("#aopen .aback"),
    "the way back is an Orb holding a chevron, named All accounts, first in the open account: " + (back && back.outerHTML.slice(0, 160)));
    await p.click(back);
    ok(d.getElementById("aopen").hidden && !d.getElementById("oAccts").classList.contains("open"), "and it returns to the list");
    /* C7 */
    await p.click(row("CX5-ZED").querySelector('[data-act="acct.open"]'));
    const was = !d.getElementById("aopen").hidden;
    await p.click(byAct(d, "part.customers.accounts"));
    ok(was && d.getElementById("aopen").hidden && !d.getElementById("oAccts").classList.contains("open") && d.querySelector('.aparts[data-place="customers"] [aria-selected="true"]').getAttribute("data-part") === "accounts",
      "the Accounts tab, tapped while an account is open, returns to the list");
    /* C6, Record's form and the open order */
    enter(d, "record", "entry"); await p.work.quiet();
    await p.click(byAct(d, "record.form", "sale-or-purchase"));
    const fb = d.getElementById("makerFormBack");
    ok(!!fb && fb.classList.contains("salt-orb") && fb.getAttribute("aria-label") === "All forms" && fb.getAttribute("data-back") === "form" && fb.getAttribute("data-act") === "record.form-back" && t(fb) === "" && !!fb.querySelector("svg path"),
      "Record's open form has the same Orb, named All forms");
    await p.click(fb);
    ok(d.querySelector('#makerInputs [data-form="sale-or-purchase"]').hidden, "and it returns to the menu");
    ok(!d.querySelector("#makerReview [data-back]") && !byAct(d, "order.back"), "the open order draws no way back of its own, the rail's Orders closes it");
    /* C8 */
    enter(d, "customers", "accounts"); await p.work.quiet();
    const lead = d.getElementById("alead");
    ok(lead.classList.contains("salt-insight") && lead.classList.contains("salt-insight--copper") && !/[.] /.test(t(lead)) && /[.]$/.test(t(lead)) && /^RM 100 is owed to you/.test(t(lead)) && t(lead).split(" ").length <= 20,
      "the lead is one sentence, money first, of twenty words at most: " + t(lead));
    /* C9, Their % and Associates */
    await p.click(p.rowOf("CX1-ZED").querySelector('[data-act="acct.open"]'));
    const pt = d.querySelector("#aopen .apct__table table");
    enter(d, "customers", "associates"); await p.work.quiet();
    const at = d.querySelector("#clist .atable table");
    const lefts = (tb) => tb ? [...tb.querySelectorAll("thead th")].map((h) => h.classList.contains("salt-table__left")) : [];
    ok(!!pt && pt.classList.contains("salt-table--rows") && !!pt.closest(".salt-table-wrap") && J(lefts(pt)) === J([true, false, false, false])
      && !!at && at.classList.contains("salt-table--rows") && !!at.closest(".salt-table-wrap") && J(lefts(at)) === J([true, true, false, false, false, true])
      && !d.querySelector("#oCustomers th.l, #oCustomers td.l"),
    "Their % and Associates are rows tables with their word columns left, and no cell keeps the Desk's l: " + J([lefts(pt), lefts(at)]));
  } catch (e) { ok(false, "admin-customers-v2 stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* the old addresses land on the parts */
  for (const [hash, part] of [["#accounts", "accounts"], ["#links", "links"], ["#cards", "associates"], ["#customers/messages", "messages"]]) {
    p = await open({ hash });
    try {
      const sel = p.d.querySelector('.aparts[data-place="customers"] [aria-selected="true"]');
      ok(!!sel && sel.getAttribute("data-part") === part, "the address " + hash + " lands on " + part + ": " + (sel && sel.getAttribute("data-part")));
    } catch (e) { ok(false, "admin-customers-v2 stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
  }

  /* from 1080px */
  p = await open({ before: wideAt });
  try {
    const d = p.d;
    enter(d, "customers", "accounts"); await p.work.quiet();
    /* C3 */
    const card = d.querySelector("#rlist > .salt-glass-card"), region = card && card.querySelector(":scope > .salt-table-wrap"), tb = region && region.querySelector("table");
    const cols = tb ? [...tb.querySelectorAll(":scope > colgroup > col")].map((c) => c.style.getPropertyValue("width")) : [];
    const heads = tb ? [...tb.querySelectorAll(":scope > thead th")] : [];
    ok(!!card && card.classList.contains("salt-glass-card--radius-lg") && card.classList.contains("salt-glass-card--pad-none") && region.getAttribute("role") === "region" && d.querySelectorAll("#rlist table").length === 1
      && tb.classList.contains("salt-table--plain") && tb.classList.contains("salt-table--rows") && J(cols) === J(["", "168px", "136px", "120px", "112px", "128px"])
      && heads.map(t).join() === "Account,Username,State,Since,Owed,Move" && heads.every((h) => h.getAttribute("scope") === "col") && !!heads[5].querySelector(".sr"),
    "from 1080px the accounts are one plain table in a glass card, a colgroup of six, its columns named and the last a screen-reader move: " + J(cols) + " " + heads.map(t).join());
    const groups = [...tb.querySelectorAll("tr.salt-table__group > th")];
    const r1 = tb.querySelector('tr[data-u="abcd-efgh"]'), cs = [...r1.children];
    ok(groups.map(t).join() === "To do,Pending,FYI" && groups.every((g) => g.getAttribute("colspan") === "6" && !!g.querySelector(".salt-settings__head")) && !d.querySelector("#rlist .salt-settings__row")
      && cs[0].tagName === "TH" && cs[0].getAttribute("scope") === "row" && cs[0].classList.contains("salt-table__left") && cs[0].firstElementChild.tagName === "A" && cs[0].firstElementChild.getAttribute("data-act") === "acct.open"
      && [1, 2, 3].every((i) => cs[i].classList.contains("salt-table__left")) && !cs[4].classList.contains("salt-table__left") && t(cs[4]) === "RM 100" && !!cs[2].querySelector(".salt-status")
      && !!cs[5].querySelector(":scope > .salt-table__act > .salt-ghost--lit") && !d.querySelector("#rlist .salt-pill") && !d.querySelector("#oCustomers th.l, #oCustomers td.l"),
    "its group heads are rows of it, the code the link that opens the account, the word cells left, the figure right, the move in the act cell: " + cs.map(t).join(" | "));
    /* the account's code link fills its cell's height, so it is a 44px target (the Orders table's shares the rule) */
    const link = (pageRules().find((x) => x[0] === ".adm .salt-table--rows tbody th a") || [, null])[1];
    ok(!!link && link.getPropertyValue("display") === "flex" && link.getPropertyValue("min-height") === "var(--salt-tap)" && cs[0].firstElementChild.classList.contains("arow__open"),
      "the account's code link in the table fills its cell's height with a 44px minimum: " + (link && link.cssText));
    /* C4 */
    await p.click(r1.querySelector('[data-act="acct.message"]'));
    const thread = d.getElementById("makerChatOpen").getAttribute("data-key") === "abcd-efgh";
    enter(d, "customers", "accounts"); await p.work.quiet();
    p.posts.length = 0;
    await p.click(d.querySelector('#rlist tr[data-u="tvwx-yz23"] [data-act="need.signin-link"]'));
    const made = p.posts.length;
    await p.click(d.querySelector('#rlist tr[data-u="jkmn-pqrs"] [data-act="acct.show-link"]'));
    const tail = d.querySelector('#rlist tr[data-u="jkmn-pqrs"] + tr.oask');
    ok(thread && made > 0 && !!tail && !tail.hidden && t(tail).length > 0, "in the table too Message opens their thread, Send makes the link and Show answers in a row under it: " + J([thread, made, t(tail)]));
    /* C5 */
    ok(!d.querySelector("#oAccts .panenone") && J([...d.querySelector("#oAccts .asplit").children].map((c) => c.id)) === J(["rlist", "aopen"]) && d.getElementById("aopen").hidden,
      "with nothing open no empty pane stands beside the table: the column holds the list and the account's pane alone");
    const R = pageRules(), rule = (sel) => (R.find((x) => x[0] === sel) || [, null])[1], get = (sel, prop) => { const r = rule(sel); return r ? r.getPropertyValue(prop) : "(none)"; };
    const W = "@(min-width:860px) ";
    ok(get(W + ".adm .asplit", "grid-template-columns") === "minmax(0,1fr)" && /minmax\(0,440px\)/.test(get(W + ".adm .nsplit,.adm #oAccts.open .asplit", "grid-template-columns")) && !R.some((x) => /panenone/.test(x[0]) && /aopen/.test(x[0])),
      "the page keeps one column for the list until an account is open, and two only then: " + J([get(W + ".adm .asplit", "grid-template-columns"), get(W + ".adm .nsplit,.adm #oAccts.open .asplit", "grid-template-columns")]));
    /* C6, from 1080px the open account shows its way back too */
    await p.click(d.querySelector('#rlist tr[data-u="rfnd-acct"] [data-act="acct.open"]'));
    const back = d.querySelector("#aopen > [data-back]");
    ok(!!back && back.classList.contains("salt-orb") && get("@(min-width:1080px) .adm #oAccts.open #aopen [data-back]", "display") === "grid", "from 1080px the open account has the same Orb, shown there");
    await p.click(back);
    ok(d.getElementById("aopen").hidden && d.querySelectorAll("#rlist table").length === 1, "and the table is there again");
  } catch (e) { ok(false, "admin-customers-v2 stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
}
