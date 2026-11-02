/* test/order-stream-v6.mjs: plan version 4, part 4a (his answer E, everyone has an account: a walk-in account always ready). A walk-in takes the
 * next free spare account at Add ID (D15, tools/fold.mjs), so Salt Admin's Needs you says when fewer than three are left (tools/stmt-pool.mjs
 * POOL_LOW), as the last publish counted them (the `sheet` record's `spares`, read through /all/sheet). FYI, no button. Drawn by the maker
 * harness (test/maker-act.mjs). The publish's count is checked in section "S14 14.1" and the Worker's answer in "v687" (test/verify.mjs), their
 * mutations in test/order-stream-v6-publish.mutations.json and test/order-stream-v6-worker.mutations.json, run against those sections. */
import { richOwnerPage, byAct, enter } from "./maker-act.mjs";
import { POOL_LOW } from "../tools/stmt-pool.mjs";
import { poolNote } from "../tools/fold.mjs";

const J = JSON.stringify;

export async function run({ ok, pageWork }) {
  const seen = async (spares) => {
    const p = await richOwnerPage({ pageWork, sheetAnswer: (j) => Object.assign({}, j, spares === undefined ? {} : { spares }) });
    try {
      await p.work.quiet();
      const d = p.d; byAct(d, "nav.needs").click(); await p.work.quiet();
      const c = d.querySelector('#nlist [data-need="x:pool"]');
      return c ? { sev: c.getAttribute("data-sev"), who: c.querySelector(".need-who").textContent, kind: c.querySelector(".nkind").textContent,
        buttons: c.querySelectorAll("button.salt-pill, button.nbtn").length } : null;
    } finally { p.w.close(); }
  };
  const two = await seen(2), none = await seen(0), three = await seen(3), old = await seen(undefined);
  ok(!!two && two.sev === "watch" && two.who === "2 ready accounts left" && /^Accounts/.test(two.kind) && two.buttons === 0,
    "W1 with two ready accounts left, Needs you says so as one FYI card, Accounts, with nothing to tap: " + J(two));
  ok(!!none && none.who === "No ready accounts left", "W2 with none left it says so: " + J(none));
  ok(!three && !old && POOL_LOW === 3, "W3 at three or more, or from a publish that counted none, no card: " + J([three, old]));
  ok(/2 ready accounts left after this Add ID: node tools\/stmt-account\.mjs --pool on the laptop makes 10 again/.test(poolNote(1, 2)) && poolNote(0, 2) === "" && poolNote(1, 3) === "",
    "W4 the fold says so when its binding leaves fewer than three, with the line that makes ten again; nothing bound, or three left, says nothing: " + J([poolNote(1, 2), poolNote(0, 2), poolNote(1, 3)]));

  /* R1 to R3, part 4b (his answer of 03 Nov 2026, "Remove it now"): Record's form records no new sale; a sale's row still changes there */
  const rows = (j) => { j.catalog.rows = [{ rid: "row-1", party: "CX1-ZED", product: "salt", date: "2026-09-01", qty: 2, total: 200, direction: "SELL", cash: 50, movedUnits: 1, delivery: 0, handover: "collected" }]; return j; };
  const p = await richOwnerPage({ pageWork, inputsAnswer: rows });
  try {
    await p.work.quiet();
    const d = p.d, w = p.w;
    enter(d, "record"); await p.work.quiet();
    const f = d.querySelector('#makerInputs section.maker-input[data-form="sale-or-purchase"]');
    const A = (a) => byAct(f, a), t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
    const typeRow = () => { const c = A("record.trade.direction"); return c && c.closest(".salt-settings__row"); };
    /* the Segment is the radiogroup its option buttons stand in; byAct finds an option */
    const dir = () => { const c = A("record.trade.direction"); return c && (c.closest('[role="radiogroup"]') || c); };
    const note = f && f.querySelector("[data-new-sale]");
    ok(!!f && !!note && !note.hidden && /new sale is placed on their own page/.test(t(note)) && !!typeRow() && typeRow().hidden && dir().value === "purchase"
      && t(A("record.trade.send")) === "Record the purchase",
      "R1 with no row chosen, Record's form records a purchase alone, Type hidden, and says a new sale is placed on their own page: " + J([!!f, note && t(note), A("record.trade.direction") && dir().value, t(A("record.trade.send"))]));
    const pick = A("record.trade.edit"); pick.value = "row-1"; pick.dispatchEvent(new w.Event("change", { bubbles: true })); await p.work.quiet();
    ok(note.hidden && !typeRow().hidden && dir().value === "sale" && t(A("record.trade.send")) === "Record the change",
      "R2 a sale's row chosen under Row still changes in it, Type shown as Sale: " + J([note.hidden, dir().value, t(A("record.trade.send"))]));
    pick.value = ""; pick.dispatchEvent(new w.Event("change", { bubbles: true })); await p.work.quiet();
    const before = p.posts.length;
    dir().value = "sale";
    A("record.trade.send").click(); await p.work.quiet();
    ok(!p.posts.slice(before).some((x) => /\/inputs\/sale$/.test(x.route)) && /Order for them/.test(t(f.querySelector(":scope > p[role=status]"))),
      "R3 a sale forced on the form with no row is never sent, and says where a new sale goes: " + J(p.posts.slice(before).map((x) => x.route)));
  } finally { p.w.close(); }
}
