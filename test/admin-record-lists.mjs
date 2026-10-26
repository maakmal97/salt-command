/* test/admin-record-lists.mjs: SALT ADMIN RECORD, P6, REWARDS, OFFSETS AND REPAYMENT (25 Oct 2026; his canvas Salt Admin Record). What is proved here, each check red
 * under its own mutation (test/admin-record-lists.mutations.json):
 *   1  a reward held is Needs you's card: its kind (an associate's, away, part free), the code, one short pill, Give or Take off, speaking its full words, and the units
 *      held at the right; a reward with nothing to give draws no pill
 *   2  an offset offered is the same card: its units and the order's day, the code, one pill, Add, speaking what it adds, and its figure in ringgit
 *   3  Repayment says what is left on the loan chosen, its figure at the right, and follows the choice
 *   4  the page's rules: the cards stack with room between, and a hidden Discard stays hidden
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct, enter } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;
const shape = (c) => [...c.children].map((x) => x.classList.contains("nkind") ? "kind" : x.classList.contains("salt-action__body") ? "body" : x.classList.contains("salt-action__go") ? "go" : x.classList.contains("nfig") ? "fig" : x.className);

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork, inputsAnswer: (j) => ({ ...j, catalog: { ...j.catalog,
    rewards: [...j.catalog.rewards, { code: "CX1-ZED", held: 1.5, free: 1, associate: false, departed: false, action: "Offset" }, { code: "CX2-ZED", held: 0.4, free: 0.4, associate: false, departed: true, action: null }],
    loans: [...j.catalog.loans, { rid: "loan-2", party: "CX2-ZED", remaining: 2, form: "salt", direction: "in" }] } }) });
  try {
    await p.work.quiet();
    const d = p.d, quiet = () => p.work.quiet();
    enter(d, "record"); await quiet();
    const form = (slug) => d.querySelector('#makerInputs section.maker-input[data-form="' + slug + '"]');
    /* 1 */
    const card = (code) => form("rewards").querySelector('[data-reward-holder="' + code + '"]');
    const read = (c) => [c.className.includes("ncard"), J(shape(c)), t(c.querySelector(".nkind")), t(c.querySelector(".need-who--code")), [...c.querySelectorAll(".salt-action__go button")].filter((b) => !b.hidden).map((b) => [t(b), b.getAttribute("aria-label"), b.classList.contains("nbtn")]), t(c.querySelector(".nfig"))];
    const got = ["AX1-ZED", "CX1-ZED", "CX2-ZED"].map((k) => read(card(k)));
    const S = J(["kind", "body", "go", "fig"]);
    ok(J(got) === J([[true, S, "Associate · held", "AX1-ZED", [["Give", "Give AX1-ZED their reward", true]], "2 units"],
        [true, S, "Held · 1 unit free", "CX1-ZED", [["Take off", "Take 1 unit off what CX1-ZED owes", true]], "1.5 units"],
        [true, S, "Held · away", "CX2-ZED", [], "0.4 unit"]]),
      "a reward held is the one card, its kind, the code, one short pill speaking its full words, and the units held; nothing to give, no pill: " + J(got));
    /* 2 */
    const off = form("offsets").querySelector(".maker-offer");
    ok(!!off && J(read(off)) === J([true, S, "1 unit off · 01 Oct 2026", "AX1-ZED", [["Add", "Add 1 unit off the order of 01 Oct 2026 for AX1-ZED", true]], "RM 100"]),
      "an offset offered is the same card, its units and the order's day, the code, Add speaking what it adds, and its ringgit: " + J(off && read(off)));
    /* 3 */
    /* 27 Oct 2026 (Record's forms as settings rows): the left-to-repay line is a row of the form's list, its words and its figure the row's label and value */
    const rp = form("repayment"), left = () => [...rp.querySelectorAll(".repay-left span")].map(t).join(" | ");
    const first = left(), pick = byAct(rp, "record.repay.loan");
    pick.value = "loan-2"; pick.dispatchEvent(new d.defaultView.Event("change", { bubbles: true })); await quiet();
    ok(first === "Left to repay | RM 5.00" && left() === "Left to repay | 2 units" && rp.querySelector(".repay-left").nextElementSibling === byAct(rp, "record.repay.date").closest("label"),
      "Repayment says what is left on the loan chosen, and follows the choice: " + J([first, left()]));
    /* 4 */
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(/\.adm \.maker-rewards,\.adm \.maker-offers\{display:flex;flex-direction:column;gap:10px\}/.test(css) && /\.adm \.maker-offer \.salt-ghost\[hidden\],\.adm \.maker-reward \.salt-ghost\[hidden\]\{display:none\}/.test(css)
      && !/\.adm \.maker-offer\{display:grid/.test(css),
      "the cards stack with room between, a hidden Discard stays hidden, and no older rule lays an offer out over the card");
  } finally { p.w.close(); }
}
