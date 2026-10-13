/* test/admin-customers.mjs: CUSTOMERS AS ROWS (the layout rework, 14 Oct 2026). Each check is red under its own mutation (test/admin-customers.mutations.json).
 *   A  an account row carries ONE state pill, the most important, and the whole row is the tap (no Open)
 *   B  a filter shows only while some account is in the state it names
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
    const locked = [...d.querySelectorAll("#rlist [data-u]")].filter((r) => /Locked out/.test(r.textContent))[0];
    ok(!!locked && locked.querySelectorAll(".salt-status").length === 1 && !byAct(locked, "acct.open-link") && !locked.querySelector(".salt-inbox-row__action") && locked.tagName === "BUTTON",
      "an account row is one tap with one state pill and no Open: " + (locked && locked.textContent));
    const owes = [...d.querySelectorAll("#rlist [data-u]")].find((r) => /owe/i.test(r.querySelector(".astate") ? r.querySelector(".astate").textContent : ""));
    ok(!!owes && owes.querySelectorAll(".salt-status").length === 1 && /Opened|Not opened/.test(owes.querySelector(".salt-inbox-row__what").textContent),
      "the owing account has its state as its one pill and Opened as part of the quiet line");
    ok([...d.querySelectorAll('#afil button[data-f]')].find((b) => b.getAttribute("data-f") === "refund") === undefined, "no filter is offered for a state the filter list does not name");
    const quiet = [...d.querySelectorAll("#rlist [data-u]")].find((r) => /CX4-ZED/.test(r.textContent));
    ok(!!quiet && quiet.querySelectorAll(".salt-status").length === 0, "an account with nothing to say has no pill: " + (quiet && quiet.textContent));
    const none = d.querySelector('#afil button[data-f="none"]'), locks = d.querySelector('#afil button[data-f="locked"]');
    ok(!!none && !none.hidden && !!locks && !locks.hidden, "a filter shows while an account is in its state");

    const q = await richOwnerPage({ pageWork, sheetAnswer: (j) => ({ ...j, accounts: j.accounts.filter((a) => !a.locked && a.account !== false) }) });
    try { await q.work.quiet(); enter(q.d, "customers", "accounts"); await q.work.quiet();
      const f = (k) => q.d.querySelector('#afil button[data-f="' + k + '"]');
      ok(!!f("all") && !f("all").hidden && f("locked").hidden && f("none").hidden && !f("owes").hidden, "a filter for a state no account is in is not offered"); }
    finally { q.w.close(); }

    enter(d, "customers", "links"); await p.work.quiet();
    const g = d.querySelector('#glist [data-link="s1"]'), off = d.querySelector('#glist [data-link="r1"]');
    ok(!!g && g.tagName === "DETAILS" && !g.open && g.querySelector("summary") && !!g.querySelector("img") && !!byAct(g, "link.copy"),
      "a guest link is a shut row holding its QR and moves");
    ok(!!off && !!off.querySelector("summary .salt-status") && /Withdrawn/.test(off.querySelector("summary").textContent) && !g.querySelector("summary .salt-status"),
      "only a withdrawn link carries a pill");
    ok(d.querySelectorAll('#glist details[open]').length === 0, "no link row is open until it is opened");

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
