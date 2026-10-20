/* test/counter-c-help.mjs: HELP UNDER ACCOUNT (Counter Batch C, P2, item 17; the four answers as he approved them on 18 Oct 2026).
 *
 * After This device on the customer's Account, a glass card headed Help holds four native details rows, Paying, Delivery, Collecting
 * and Changing an order, each closed until tapped, its summary 44px tall with a chevron. Every check observes the signed-in page in
 * jsdom (test/counter-b-kit.mjs) or his page as landingPage draws it; each was proved red by its own mutation
 * (test/counter-c-help.mutations.json, tools/section.mjs).
 *   1  the card follows This device on Account, headed Help, its four questions in order
 *   2  the four answers word for word as approved, no em dash
 *   3  every row closed when Account opens, and a tap on a summary opens that row alone
 *   4  each summary is 44px tall, read off the page's own rule and the tap token, with its chevron
 *   5  Salt Admin's Account draws no Help */
import { open, txt } from "./counter-b-kit.mjs";

const ANSWERS = [
  ["Paying", "Pay by transfer or scan the code under To pay, with your username as the reference. Then tell us you sent it. It counts once we confirm it arrived."],
  ["Delivery", "Choose ASAP, or a four-hour window. We confirm the time when we accept. If we need another time, we ask you first."],
  ["Collecting", "We tell you when it is ready and where to collect it. Pay before you come, or in cash when you collect where your order offers it."],
  ["Changing an order", "Until we confirm it, open the order and tap Change order. After that, send us a message on the order and we change it for you."],
];

export async function run({ ok, pageWork }) {
  const P = await import("../stmt/page.js?" + Date.now());
  const A = await open({ pageWork });
  try {
    const d = A.d, card = d.getElementById("aHelp"), rows = card ? [...card.querySelectorAll("details.ahelp__q")] : [];
    /* ---- 1 ---- */
    ok(card && card.previousElementSibling && card.previousElementSibling.id === "thisDevice" && card.closest("#acct")
      && txt(card.querySelector("h2")) === "Help" && rows.map((r) => txt(r.querySelector("summary"))).join("|") === ANSWERS.map((a) => a[0]).join("|"),
      "Help follows This device on Account, its four questions in order: " + rows.map((r) => txt(r.querySelector("summary"))).join("|"));
    /* ---- 2 ---- */
    const said = rows.map((r) => txt(r.querySelector(".ahelp__a")));
    ok(said.length === 4 && said.every((s, i) => s === ANSWERS[i][1]) && !/\u2014/.test(card.textContent), "the four answers word for word, no em dash: " + JSON.stringify(said));
    /* ---- 3 ---- */
    const closed = rows.every((r) => !r.open);
    if (rows[1]) rows[1].querySelector("summary").click();
    ok(closed && rows.length === 4 && rows[1].open && !rows[0].open && !rows[2].open && !rows[3].open, "every row closed on opening, and a tap opens that row alone");
    /* ---- 4 ---- */
    const html = P.landingPage("abcd-efgh", "nh", null).replace(/\/\*[\s\S]*?\*\//g, "");
    const sum = /\.ahelp__sum\{([^}]*)\}/.exec(html), tap = /--salt-tap:\s*44px/.test(html);
    ok(sum && /min-height:var\(--salt-tap\)/.test(sum[1]) && tap && rows.every((r) => r.querySelector("summary .glyph")),
      "each summary is 44px tall by the page's own rule, with its chevron: " + (sum && sum[1]));
    /* ---- 5 ---- */
    const his = P.landingPage("", "nho", { master: "fixture-master", accounts: [] });
    ok(!/id="aHelp"/.test(his) && /id="acct"/.test(his), "Salt Admin's Account draws no Help");
  } finally { A.close(); }
}
