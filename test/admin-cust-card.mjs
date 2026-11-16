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
import { richOwnerPage, byAct, enter, answerSheets } from "./maker-act.mjs";
import { landingPage } from "../stmt/page.js";
import { SITE_CSS } from "../stmt/statement-css.js";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;
const ISO = "2026-10-10T08:00:00.000Z";

export async function run({ ok, pageWork }) {
  const due = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10) /* 28 Oct 2026: the page's age is elapsed time from the due date's UTC midnight (ageOf), so a UTC date three days back reads 3 d at every hour; the 27 Oct Kuala Lumpur date read 2 d late from 16:00 to 24:00 UTC */;
  const refund = { username: "rfnd-acct", code: "CX5-ZED", account: true, t: { owed: 0, toGet: 0, refund: 25, pend: 0 }, flag: "refund", seen: { opens: 2, last: ISO, how: "qr" }, sent: ISO, issued: "2026-10-01" };
  const p = await richOwnerPage({ pageWork, sheetAnswer: (j) => ({ ...j, accounts: j.accounts.concat([refund]) }),
    extra: (route) => (/^\/all\/sent\//.test(route) ? { ok: true, sent: ISO } : undefined),
    inputsAnswer: (j) => ({ ...j, catalog: { ...j.catalog, owedMoney: [{ party: "CX1-ZED", rm: 100, since: "2026-10-01", due, rows: [{ rid: "s1", key: "k1", product: "salt" }] }], owedGoods: [] } }) });
  try {
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    await p.work.quiet();
    enter(d, "customers", "accounts"); await p.work.quiet();
    /* 2 Nov 2026 (Customers on the canvas): an account is a settings row, its code the .acode in the row, and the account opens from the row's own text (acct.open), no longer from the card */
    const card = (code) => [...d.querySelectorAll("#rlist [data-u]")].find((c) => t(c.querySelector(".acode")) === code);
    const open = async (code) => { await click(card(code).querySelector('[data-act="acct.open"]')); return d.querySelector("#aopen .oacct"); };
    /* 1 */
    let a = await open("CX1-ZED");
    const head = a.querySelector(".ahead"), fig = head.querySelector(".ahead__fig");
    /* 2 Nov 2026 (his Orders canvas, page 2): the head is the band (salt-band), no longer a glass card */
    /* 16 Nov 2026, the move to Ambient (place H): the head is the code (Ambient's section head), a chip for the state with its age and the username, and the figure as Ambient's stat */
    ok(!head.classList.contains("salt-band") && t(head.querySelector(".ahead__kind")) === "Owed" && t(head.querySelector(".nage")) === "3 d late" && head.querySelector(".nage").classList.contains("amb-neg") && t(head.querySelector("h2.amb-section.ahead__code")) === "CX1-ZED"
      && t(head.querySelector(".un")) === "abcd-efgh" && J([...fig.children].map(t)) === J(["They owe", "RM 100"]) && fig.classList.contains("amb-stat") && fig.querySelector(".amb-stat__value").classList.contains("amb-neg"),
      "the head: the code, the state and its age, the username, and what they owe, in ember when late: " + t(head));
    /* 2 */
    /* 2 Nov 2026 (his Orders canvas, page 2): the standing is a settings list, a row a line (label and value) */
    const lines = (box) => [...box.querySelectorAll(".astand .amb-setting")].map((l) => t(l.querySelector(".amb-setting__name")) + "=" + t(l.querySelector(".amb-setting__value")));
    ok(J(lines(a)) === J(["Opened=10 Oct 2026 by link", "Marked sent=10 Oct 2026", "Notifications=On"]) && !a.querySelector(".achips"),
      "a ledger of the standing in place of the chips: " + J(lines(a)));
    /* 3 */
    const reply = byAct(a, "acct.reply", "abcd-efgh");
    /* 2 Nov 2026: their waiting line is a row that goes to the thread (it was a filled Reply pill in the head) */
    ok(!!reply && reply.classList.contains("amb-setting") && reply.tagName === "BUTTON" && !reply.classList.contains("salt-pill") && !reply.closest(".ahead") && !!reply.closest(".amb-settings.athread")
      && t(reply.querySelector(".amb-setting__name")) === "Their messages" && /^Waiting \d+ (min|h|d)$/.test(t(reply.querySelector(".amb-setting__value"))),
      "their waiting line is a row that goes to the thread: " + t(a.querySelector(".athread")));
    await click(reply);
    ok(!d.querySelector('[data-in="customers.messages"]').hidden && d.getElementById("makerChatOpen").getAttribute("data-key") === "abcd-efgh", "Reply opens their thread");
    enter(d, "customers", "accounts"); await p.work.quiet();
    a = await open("CX1-ZED");
    /* 4 */
    const sign = a.querySelector(".asign"), acts = [...sign.querySelectorAll("button")].filter((b) => !b.hidden).map((b) => b.getAttribute("data-act"));
    /* 2 Nov 2026 (his Orders canvas, page 2): Sign-in is rows (Show a code, View as them, Order for them) with the one filled pill under them; Copy password and
       Sign out everywhere are danger rows alone in .aend at the card's end */
    const endActs = [...a.querySelectorAll(".aend button")].map((b) => b.getAttribute("data-act")), aend = a.querySelector(".amb-settings.aend");
    ok(t(sign.querySelector("h3.amb-settings__head")) === "Sign-in" && J(acts) === J(["acct.show-code", "acct.view-as", "acct.order-for"])
      /* 5 Nov 2026 (the pane, his answer B): Send a sign-in link, the one pill, is the card's pinned foot, its last child, after the ends */
      && a.querySelectorAll(".salt-pill").length === 0 && a.lastElementChild.matches(".amb-foot.afoot") && a.lastElementChild.querySelector(".apill").getAttribute("data-act") === "acct.signin-link"
      && a.lastElementChild.children.length === 1 && a.lastElementChild.firstElementChild.classList.contains("amb-pill--block")
      && J(endActs) === J(["acct.password", "acct.signout-all"]) && aend.querySelector("li:last-child > button").classList.contains("asignout")
      && [...aend.querySelectorAll("button")].every((b) => b.classList.contains("amb-action") && b.classList.contains("amb-action--danger"))
      && !!(sign.compareDocumentPosition(aend) & 4) && !a.querySelector('input[type="checkbox"]') && t(byAct(sign, "acct.show-code")) === "Show a code",
      "Sign-in is rows with Send a sign-in link its one pill, Copy password and Sign out everywhere last, in ember, no checkbox: " + J([acts, endActs]));
    /* 2 Nov 2026: both ember rows ask on the Sheet first, and send nothing before the yes; Not now ends it */
    const asked = [];
    let yes = false;
    answerSheets(p.w, asked, () => yes);
    const signOutPosts = () => p.posts.filter((x) => /^\/all\/signout/.test(x.route)).length;
    p.posts.length = 0;
    await click(byAct(a, "acct.signout-all"));
    ok(asked.length === 1 && /^Sign out everywhere[?]/.test(asked[0]) && signOutPosts() === 0, "Sign out everywhere asks on the Sheet, and Not now sends nothing: " + J(asked));
    yes = true;
    await click(byAct(a, "acct.signout-all"));
    ok(asked.length === 2 && signOutPosts() === 1, "and the yes signs them out everywhere, once: " + signOutPosts());
    yes = false;
    await click(byAct(a, "acct.password"));
    ok(asked.length === 3 && /^Copy their password[?]/.test(asked[2]), "Copy password asks on the Sheet first, Copy their password?: " + J(asked[2]));
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
    ok(J([...r.querySelector(".ahead__fig").children].map(t)) === J(["Their credit", "RM 25"]) && r.querySelector(".ahead__fig .amb-stat__value").classList.contains("amb-neg") && J(lines(r))[0] && lines(r)[0] === "Opened=10 Oct 2026 by code",
      "a refund he owes is his figure, in ember, and an open by a code says so: " + J([t(r.querySelector(".ahead__fig")), lines(r)]));
    /* 2, locked */
    const l = await open("CX3-ZED");
    ok(/^Locked out=until \d\d:\d\d$/.test(lines(l)[0]) && l.querySelector(".astand .amb-setting__value.amb-neg") && lines(l)[1] === "Opened=Not yet", "a locked account says until when, in ember, first: " + J(lines(l)));
    /* 6 */
    const n = await open("CX2-ZED");
    ok(J(lines(n)) === J(["Account=Next update"]) && !n.querySelector(".ahead__fig") && /next update/.test(t(n.querySelector(".atot"))) && byAct(n, "acct.signin-link").disabled && byAct(n, "acct.sent").hidden,
      "an ID with no account says so and offers nothing it cannot do: " + J(lines(n)));
  } finally { p.w.close(); }
  /* 7 */
  /* 16 Nov 2026, the move to Ambient (place H): the code wraps anywhere in its own width, the figure is Ambient's stat in tabular figures; the layer's rule, tokens only */
  ok(/\.ahead__code, \.chathead__code \{ overflow-wrap: anywhere; \}/.test(SITE_CSS) && /\.ahead \.un \{[^}]*font-family: var\(--amb-font-mono\)/.test(SITE_CSS), "the code never overflows its pane, the username in the mono face");
}
