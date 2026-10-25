/* test/admin-cust-card.mjs: SALT ADMIN CUSTOMERS, P2, AN ACCOUNT'S HEAD AND SIGN-IN (25 Oct 2026; canvas Salt Admin Customers, his yes to Asks A to J). Each
 * check is red under its own mutation (test/admin-cust-card.mutations.json):
 *   1  the head says where the account stands as its card on the list does (the state and its age), the code and the username, and the figure at the right,
 *      in ember when late or when he owes it back
 *   2  under it a ledger of the standing: opened and how, marked sent, notifications; locked out until when, in ember
 *   3  a line of theirs waiting stands in the head with Reply, which opens their thread
 *   4  Sign-in is its own card: Send a sign-in link first, then Show a code, View as them, Order for them and Copy password, Sign out everywhere last and
 *      the width of the card; no checkbox
 *   5  the Sent tick is gone (Ask F): Mark as sent while it is not, which marks it and leaves a Marked sent line; none once it is
 *   6  an ID with no account says so in its head and offers nothing it cannot do
 *   7  the page's rules: the code and the figure never wrap, the head's figure in the mono face
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct, enter } from "./maker-act.mjs";
import { landingPage } from "../stmt/page.js";
import { FONT_FACE_CSS, STATEMENT_CSS, SITE_RECIPES } from "../stmt/statement-css.js";
import { JSDOM } from "jsdom";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;
const ISO = "2026-10-10T08:00:00.000Z";

function pageRules() {
  const html = landingPage("", "card-nonce", { master: "fixture-master", accounts: [] });
  const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [, ""])[1].slice((FONT_FACE_CSS + STATEMENT_CSS + SITE_RECIPES).length);
  const sheet = new JSDOM("<style>" + css + "</style>").window.document.styleSheets[0];
  const out = [];
  const walk = (rules) => { for (const r of rules) { if (r.selectorText) out.push([r.selectorText, r.style]); if (r.cssRules) walk(r.cssRules); } };
  walk(sheet.cssRules);
  return out;
}

export async function run({ ok, pageWork }) {
  const due = new Date(Date.now() - 3 * 86400000 - 3600000).toISOString().slice(0, 10);
  const refund = { username: "rfnd-acct", code: "CX5-ZED", account: true, t: { owed: 0, toGet: 0, refund: 25, pend: 0 }, flag: "refund", seen: { opens: 2, last: ISO, how: "qr" }, sent: ISO, issued: "2026-10-01" };
  const p = await richOwnerPage({ pageWork, sheetAnswer: (j) => ({ ...j, accounts: j.accounts.concat([refund]) }),
    extra: (route) => (/^\/all\/sent\//.test(route) ? { ok: true, sent: ISO } : undefined),
    inputsAnswer: (j) => ({ ...j, catalog: { ...j.catalog, owedMoney: [{ party: "CX1-ZED", rm: 100, since: "2026-10-01", due, rows: [{ rid: "s1", key: "k1", product: "salt" }] }], owedGoods: [] } }) });
  try {
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    await p.work.quiet();
    enter(d, "customers", "accounts"); await p.work.quiet();
    const card = (code) => [...d.querySelectorAll("#rlist [data-u]")].find((c) => t(c.querySelector(".need-who")) === code);
    const open = async (code) => { await click(card(code)); return d.querySelector("#aopen .oacct"); };
    /* 1 */
    let a = await open("CX1-ZED");
    const head = a.querySelector(".ahead"), fig = head.querySelector(".ahead__fig");
    ok(head.classList.contains("salt-glass-card") && t(head.querySelector(".ahead__kind")) === "Owed · 3 d late" && t(head.querySelector("h2.ahead__code")) === "CX1-ZED"
      && t(head.querySelector(".un")) === "abcd-efgh" && J([...fig.children].map(t)) === J(["They owe", "RM 100"]) && fig.querySelector(".ahead__rm").classList.contains("ahead__rm--hot"),
      "the head: the state and its age, the code, the username, and what they owe at the right, in ember when late: " + t(head.querySelector(".ahead__top")));
    /* 2 */
    const lines = (box) => [...box.querySelectorAll(".astand .salt-ledger__line")].map((l) => t(l.children[0]) + "=" + t(l.children[1]));
    ok(J(lines(a)) === J(["Opened=10 Oct 2026 by link", "Marked sent=10 Oct 2026", "Notifications=On"]) && !a.querySelector(".achips"),
      "a ledger of the standing in place of the chips: " + J(lines(a)));
    /* 3 */
    const reply = byAct(a, "acct.reply", "abcd-efgh");
    ok(!!reply && reply.classList.contains("salt-pill") && !!reply.closest(".ahead") && t(reply.closest(".athread").querySelector(".athread__k")) === "Their messages" && /^Waiting \d+ (min|h|d) for your reply$/.test(t(reply.closest(".athread").querySelector(".athread__v"))),
      "their waiting line stands in the head with Reply: " + t(a.querySelector(".athread")));
    await click(reply);
    ok(!d.querySelector('[data-in="customers.messages"]').hidden && d.getElementById("makerChatOpen").getAttribute("data-key") === "abcd-efgh", "Reply opens their thread");
    enter(d, "customers", "accounts"); await p.work.quiet();
    a = await open("CX1-ZED");
    /* 4 */
    const sign = a.querySelector(".asign"), acts = [...sign.querySelectorAll("button")].filter((b) => !b.hidden).map((b) => b.getAttribute("data-act"));
    ok(sign.classList.contains("salt-glass-card") && t(sign.querySelector("h3")) === "Sign-in" && J(acts) === J(["acct.signin-link", "acct.show-code", "acct.view-as", "acct.order-for", "acct.password", "acct.signout-all"])
      && sign.querySelector(".agrid").lastElementChild.classList.contains("asignout") && !a.querySelector('input[type="checkbox"]') && t(byAct(sign, "acct.show-code")) === "Show a code",
      "Sign-in is its own card, Send first, four ways two by two, Sign out everywhere last and wide, no checkbox: " + J(acts));
    ok(byAct(a, "acct.sent").hidden, "an account already sent offers no Mark as sent");
    /* 5 */
    const four = await open("CX4-ZED"), mark = byAct(four, "acct.sent");
    ok(!!mark && !mark.hidden && t(mark) === "Mark as sent" && !lines(four).some((l) => /^Marked sent/.test(l)), "an account not sent offers Mark as sent, and no Marked sent line");
    p.posts.length = 0;
    await click(mark);
    const after = d.querySelector("#aopen .oacct");
    ok(p.posts.some((x) => /^\/all\/sent\//.test(x.route) && x.body && x.body.sent === true) && byAct(after, "acct.sent").hidden && lines(after).includes("Marked sent=10 Oct 2026"),
      "Mark as sent marks it, and the card says Marked sent where the button was: " + J(lines(after)));
    /* 1, his own debt */
    const r = await open("CX5-ZED");
    ok(J([...r.querySelector(".ahead__fig").children].map(t)) === J(["You owe them", "RM 25"]) && r.querySelector(".ahead__rm").classList.contains("ahead__rm--hot") && J(lines(r))[0] && lines(r)[0] === "Opened=10 Oct 2026 by code",
      "a refund he owes is his figure, in ember, and an open by a code says so: " + J([t(r.querySelector(".ahead__fig")), lines(r)]));
    /* 2, locked */
    const l = await open("CX3-ZED");
    ok(/^Locked out=until \d\d:\d\d$/.test(lines(l)[0]) && l.querySelector(".astand--hot") && lines(l)[1] === "Opened=Not yet", "a locked account says until when, in ember, first: " + J(lines(l)));
    /* 6 */
    const n = await open("CX2-ZED");
    ok(J(lines(n)) === J(["Account=Next update"]) && !n.querySelector(".ahead__fig") && /next update/.test(t(n.querySelector(".atot"))) && byAct(n, "acct.signin-link").disabled && byAct(n, "acct.sent").hidden,
      "an ID with no account says so and offers nothing it cannot do: " + J(lines(n)));
  } finally { p.w.close(); }
  /* 7 */
  const R = pageRules(), rule = (sel) => (R.find((x) => x[0] === sel) || [, null])[1];
  const code = rule(".adm .oacct .ahead h2.ahead__code"), rm = rule(".adm .ahead__rm");
  ok(!!code && code.getPropertyValue("white-space") === "nowrap" && code.getPropertyValue("text-overflow") === "ellipsis" && !!rm && rm.getPropertyValue("white-space") === "nowrap"
    && rm.getPropertyValue("font-family") === "var(--salt-font-mono)", "the code and the figure never wrap, the figure in the mono face");
}
