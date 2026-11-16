/* test/admin-cust-wide.mjs: SALT ADMIN CUSTOMERS, P8, THE WIDE PAGE (26 Oct 2026; his yes to Asks C and D; re-aimed 2 Nov 2026 to his Customers canvas, whose table is
 * ONE table for every group, drawn from 1080px in place of the settings lists). Each check is red under its own mutation (test/admin-cust-wide.mutations.json):
 *   1  from 1080px the accounts are one plain table, a row an account: the code, the username, the state, since when, what is owed and the way
 *   2  the code's tap opens the account, and the way of money owed opens their thread
 *   3  the page's rules from 1080px: an open account takes the list's place with its way back and fills the page in columns, two, and three from 1440px, each
 *      section whole in its column; Links and Associates use the width
 * Drawn by the maker harness (test/maker-act.mjs), at a width of 1100px (matchMedia answers 860 and 1080). */
import { richOwnerPage, enter } from "./maker-act.mjs";
import { SITE_CSS } from "../stmt/statement-css.js";
const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;
const wideAt = (w) => { w.matchMedia = (q) => ({ matches: /min-width:\s*(860|1080)px/.test(q) && !/max-width/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }); };

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork, before: wideAt });
  try {
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    await p.work.quiet();
    enter(d, "customers", "accounts"); await p.work.quiet();
    /* 16 Nov 2026, the move to Ambient (place H): wide there is no table; the accounts are the same rows beside the open account, the system's two panes */
    /* 1 */
    const row = (u) => d.querySelector('#rlist li[data-u="' + u + '"]'), cells = (u) => (row(u) ? [...row(u).querySelectorAll(".amb-row__sub, .amb-row__trail")].map(t) : []);
    if (!row("abcd-efgh")) { ok(false, "the accounts are rows"); return; }
    ok(!d.querySelector("#rlist table") && J(cells("abcd-efgh")) === J(["Owed, RM 100", "Message"]) && /^Locked, to \d\d:\d\d$/.test(cells("tvwx-yz23")[0]) && cells("tvwx-yz23")[1] === "Send" && !d.querySelector("#rlist .salt-settings"),
      "the accounts are Ambient's rows, a row an account, wide too: " + J([cells("abcd-efgh"), cells("tvwx-yz23")]));
    /* 2 */
    await click(row("tvwx-yz23").querySelector('[data-act="acct.open"]'));
    const opened = !!d.querySelector('#aopen [data-acct="tvwx-yz23"]') && d.getElementById("oAccts").classList.contains("open");
    await click(d.querySelector("#aopen [data-back]"));
    await click(row("abcd-efgh").querySelector('[data-act="acct.message"]'));
    ok(opened && d.getElementById("makerChatOpen").getAttribute("data-key") === "abcd-efgh", "the row opens the account, and Message opens their thread");
    /* 3 */
    const css = SITE_CSS.replace(/\s+/g, " ");
    ok(/@container amb \(min-width: 960px\) \{ \.aback \{ display: none; \} \}/.test(css) && /@container amb \(max-width: 959px\) \{ #oAccts\.open \.afind, #oAccts\.open #rlist,[^}]*display: none; \}/.test(css)
      && /#oAccts:not\(\.open\) #aside[^}]*display: none/.test(css) && !/column-count/.test(css.split("Customers (Salt Admin)")[1] || ""),
      "from 960px an open account stands beside the list with no way back; narrower it takes the list's place, which the way back returns; the layer keeps no columns of its own");
  } finally { p.w.close(); }
}
