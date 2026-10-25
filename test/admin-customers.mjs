/* test/admin-customers.mjs: CUSTOMERS AS ROWS (the layout rework, 14 Oct 2026). Each check is red under its own mutation (test/admin-customers.mutations.json).
 *   A  an account row is Needs you's card (25 Oct 2026): its state and age, its one way, its sum; the card itself is the tap
 *   B  a filter with no account in its state is dimmed and cannot be chosen
 *   C  a guest link is one row: its address, QR and moves are inside a shut details, opened by its summary; a withdrawn link says so in a pill
 *   D  an associate's code is its own element beside its marks, its counts a ledger
 *   E  an account's card lists its loans with the date, what was lent, repaid and left, and Repayment opens Record's form with that loan chosen; their reward stands there */
import { richOwnerPage, byAct, enter } from "./maker-act.mjs";
const ISO = "2026-10-10T08:00:00.000Z";

export async function run({ ok, pageWork }) {
  const loans = [{ rid: "loan-0", party: "CX9-ZED", remaining: 1, form: "cash", direction: "in" }, { rid: "loan-1", party: "CX1-ZED", date: "2026-09-15", form: "cash", value: 500, repaid: 200, remaining: 300, direction: "out" },
    { rid: "loan-2", party: "CX2-ZED", remaining: 5, form: "cash", direction: "in" }];
  const p = await richOwnerPage({ pageWork,
    inputsAnswer: (j) => { j.catalog.loans = loans; j.catalog.parties = ["CX1-ZED", "CX2-ZED"]; j.catalog.rewards = [{ code: "CX1-ZED", held: 2, free: 1, associate: false, departed: false }]; return j; },
    assocAnswer: (j) => ({ ...j, products: [{ product: "salt", rows: [{ id: "CV5-BRN", founder: true, rank: 1, bought: 10, soldFor: 5, introduced: 2, onward: 3, referred: 2, share: 12 }] }] }) });
  try {
    const d = p.d; await p.work.quiet();
    enter(d, "customers", "accounts"); await p.work.quiet();
    const row = (u) => d.querySelector('#rlist [data-u="' + u + '"]');
    const cards = () => [...d.querySelectorAll("#rlist .ncard[data-u]")], kindOf = (r) => (r.querySelector(".nkind") || {}).textContent || "";
    const locked = cards().filter((r) => /^Locked/.test(kindOf(r)))[0];
    ok(!!locked && locked.tagName === "ARTICLE" && locked.classList.contains("salt-action") && locked.getAttribute("data-need") === "a:" + locked.getAttribute("data-u")
      && locked.querySelectorAll(".salt-action__go button").length === 1 && /Send/.test(locked.querySelector(".salt-action__go button").textContent)
      && !locked.querySelector(".salt-inbox-row__action") && !locked.classList.contains("salt-inbox-row"),
      "an account row is Needs you's card with its one Send button and no Open: " + (locked && locked.textContent));
    const owes = cards().find((r) => /^Owed/.test(kindOf(r)));
    ok(!!owes && /^RM [0-9]/.test((owes.querySelector(".nfig") || {}).textContent || "") && owes.querySelectorAll(".salt-action__go button").length === 1,
      "the owing account has Owed as its kind and its sum as its figure: " + (owes && owes.textContent));
    ok([...d.querySelectorAll('#afil button[data-f]')].find((b) => b.getAttribute("data-f") === "refund") === undefined, "no filter is offered for a state the filter list does not name");
    const quiet = cards().find((r) => /CX4-ZED/.test(r.textContent));
    ok(!!quiet && quiet.querySelectorAll(".salt-status").length === 0, "an account with nothing to say has no pill: " + (quiet && quiet.textContent));
    const none = d.querySelector('#afil button[data-f="none"]'), locks = d.querySelector('#afil button[data-f="locked"]');
    ok(!!none && !none.disabled && !!locks && !locks.disabled && none.getAttribute("role") === "tab", "a filter can be chosen while an account is in its state");

    const q = await richOwnerPage({ pageWork, sheetAnswer: (j) => ({ ...j, accounts: j.accounts.filter((a) => !a.locked && a.account !== false) }) });
    try { await q.work.quiet(); enter(q.d, "customers", "accounts"); await q.work.quiet();
      const f = (k) => q.d.querySelector('#afil button[data-f="' + k + '"]');
      ok(!!f("all") && !f("all").disabled && f("locked").disabled && f("none").disabled && !f("owes").disabled && !f("locked").hidden, "a filter for a state no account is in is dimmed and cannot be chosen, not hidden"); }
    finally { q.w.close(); }

    enter(d, "customers", "links"); await p.work.quiet();
    const g = d.querySelector('#glist .glink[data-link="s1"]'), off = d.querySelector('#glist .glink[data-link="r1"]');
    const gc = d.querySelector('#glist [data-glink="s1"]'), oc = d.querySelector('#glist [data-glink="r1"]');
    ok(!!g && !!gc && g.hidden && !g.open && gc.getAttribute("aria-expanded") === "false" && !!g.querySelector("img") && !!byAct(g, "link.copy"),
      "a guest link is Needs you's card with its panel, holding the QR and moves, hidden until the card is tapped");
    ok(!!off && !!oc && oc.classList.contains("off") && /Withdrawn/.test(oc.querySelector(".nkind").textContent) && !/Withdrawn/.test(gc.querySelector(".nkind").textContent),
      "only a withdrawn link's card says Withdrawn in its kind line and is dimmed");
    ok(d.querySelectorAll('#glist .glink:not([hidden])').length === 0, "no link panel is open until its card is tapped");

    enter(d, "customers", "associates"); await p.work.quiet();
    const card = d.querySelector("#clist .acard");
    ok(!!card && !!card.querySelector(".srow > b.acode") && !!card.querySelector(".srow > .un") && card.querySelectorAll(".aled .salt-ledger__row").length === 3
      && /Resales/.test(card.querySelector(".aled").textContent), "an associate's code stands beside its marks and its counts are a ledger");

    enter(d, "customers", "accounts"); await p.work.quiet();
    const u = [...d.querySelectorAll("#rlist [data-u]")].find((r) => /CX1-ZED/.test(r.textContent));
    u.click(); await p.work.quiet(); await p.work.quiet();
    const box = d.querySelector(".oacct .abooks"), loanRows = box ? [...box.querySelectorAll(".aloan")] : [];
    ok(loanRows.length === 1 && loanRows[0].getAttribute("data-loan") === "loan-1" && /Lent 15 Sep 2026, RM 500\.00/.test(loanRows[0].textContent)
      && /Repaid\s*RM 200\.00/.test(loanRows[0].textContent) && /Left\s*RM 300\.00/.test(loanRows[0].textContent),
    "the card lists this customer's loan only, with its date, what was lent, repaid and left: " + (box && box.textContent));
    ok(!!box && !!box.querySelector('[data-reward="CX1-ZED"]') && /Reward: 2 units held, 1 unit free/.test(box.textContent), "their reward standing is on the card: " + (box && box.textContent));
    const go = byAct(loanRows[0], "acct.repay", "loan-1");
    go.click(); await p.work.quiet(); await p.work.quiet();
    const form = d.querySelector('#makerInputs [data-form="repayment"]'), pick = form && form.querySelector('[data-act="record.repay.loan"]');
    ok(!!form && !form.hidden && !!pick && pick.value === "loan-1", "Repayment opens Record's form with that loan chosen: " + (pick && pick.value));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
}
