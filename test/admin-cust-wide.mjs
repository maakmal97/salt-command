/* test/admin-cust-wide.mjs: SALT ADMIN CUSTOMERS, P8, THE WIDE PAGE (26 Oct 2026; his yes to Asks C and D). Each check is red under its own mutation
 * (test/admin-cust-wide.mutations.json):
 *   1  each group of accounts is also one plain table, a row an account: the code, the username, the state, since when, what is owed and the way
 *   2  the code's tap opens the account, and the way of money owed opens their thread
 *   3  the page's rules from 1080px: the table shows and the cards hide; an open account takes the list's place with its way back and fills the page in
 *      columns, two, and three from 1440px, each section whole in its column; Links and Associates use the width
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, enter } from "./maker-act.mjs";
import { landingPage } from "../stmt/page.js";
import { FONT_FACE_CSS, STATEMENT_CSS, SITE_RECIPES } from "../stmt/statement-css.js";
import { JSDOM } from "jsdom";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;

function pageRules() {
  const html = landingPage("", "wide-nonce", { master: "fixture-master", accounts: [] });
  const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [, ""])[1].slice((FONT_FACE_CSS + STATEMENT_CSS + SITE_RECIPES).length);
  const sheet = new JSDOM("<style>" + css + "</style>").window.document.styleSheets[0];
  const out = [];
  const walk = (rules, media) => { for (const r of rules) { if (r.selectorText) out.push([media + r.selectorText, r.style]); if (r.cssRules) walk(r.cssRules, r.conditionText ? "@" + r.conditionText + " " : media); } };
  walk(sheet.cssRules, "");
  return out;
}

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork });
  try {
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    await p.work.quiet();
    enter(d, "customers", "accounts"); await p.work.quiet();
    /* 1 */
    const tables = [...d.querySelectorAll("#rlist .ngroup .atable2 table.salt-table--plain")];
    const row = (u) => d.querySelector('#rlist .atable2 tr[data-row-u="' + u + '"]'), cells = (u) => (row(u) ? [...row(u).children].map(t) : []);
    if (!row("abcd-efgh")) { ok(false, "each group is one plain table, a row an account"); return; }
    ok(tables.length === d.querySelectorAll("#rlist .ngroup").length && tables.length >= 2 && J([...tables[0].querySelectorAll("thead th")].map(t)) === J(["Account", "Username", "State", "Since", "Owed", ""])
      && J(cells("abcd-efgh")) === J(["CX1-ZED", "abcd-efgh", "Owed", "", "RM 100", "Message"]) && cells("tvwx-yz23")[2] === "Locked" && /^to \d\d:\d\d$/.test(cells("tvwx-yz23")[3])
      && cells("tvwx-yz23")[5] === "Send",
      "each group is one plain table, a row an account: " + J([cells("abcd-efgh"), cells("tvwx-yz23")]));
    /* 2 */
    await click(row("tvwx-yz23").querySelector('[data-act="acct.open-row"]'));
    const opened = !!d.querySelector('#aopen [data-acct="tvwx-yz23"]') && d.getElementById("oAccts").classList.contains("open");
    await click(row("abcd-efgh").querySelector('[data-act="acct.message-row"]'));
    ok(opened && d.getElementById("makerChatOpen").getAttribute("data-key") === "abcd-efgh", "the code opens the account, and Message opens their thread");
    /* 3 */
    const R = pageRules(), rule = (sel) => (R.find((x) => x[0] === sel) || [, null])[1], get = (sel, prop) => { const r = rule(sel); return r ? r.getPropertyValue(prop) : "(none)"; };
    const W = "@(min-width:1080px) ";
    const got = [get(".adm .atable2", "display"), get(W + ".adm .atable2", "display"), get(W + ".adm .alist .ngroup>.ncard", "display"), get(W + ".adm #oAccts.open .asplit", "grid-template-columns"),
      get(W + ".adm #oAccts.open #aopen .aback", "display"), get(W + ".adm #aopen .oacct", "column-count"), get("@(min-width:1440px) .adm #aopen .oacct", "column-count"),
      get(W + ".adm #aopen .oacct .asec", "break-inside"), get(W + ".adm #aopen .oacct .amore", "display"), get(W + ".adm #oLinks,.adm #oCards", "max-width")];
    ok(J(got) === J(["none", "block", "none", "minmax(0,1fr)", "inline-flex", "2", "3", "avoid", "contents", "none"]),
      "from 1080px the table shows and the cards hide, an open account fills the page in columns with its way back, three from 1440px, and Links and Associates use the width: " + J(got));
  } finally { p.w.close(); }
}
