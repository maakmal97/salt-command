/* test/admin-cust-assoc.mjs: SALT ADMIN CUSTOMERS, P7, ASSOCIATES (26 Oct 2026; canvas Salt Admin Customers). Each check is red under its own mutation
 * (test/admin-cust-assoc.mutations.json):
 *   1  a book is its typed tag and how many associates, no other word for it
 *   2  an associate's card: Bought, Sold and Introduced right-aligned, the reward on a tiered book the system's Meter (units left, the way to the next)
 *   3  the same book as one plain table, shown from 860px with the cards hidden, a row an associate
 *   4  the code opens the associate's account under Accounts
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, enter } from "./maker-act.mjs";
import { landingPage } from "../stmt/page.js";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork, assocAnswer: (j) => ({ ...j, products: [
    { product: "salt", rows: [{ id: "CX1-ZED", founder: true, rank: 1, stars: 3, bought: 2480, soldFor: 1150, introduced: 640, onward: 3, reward: { earned: 3, taken: 1, left: 1.4, next: 0.8 } }] },
    { product: "oil", rows: [{ id: "CX9-NOAC", rank: 2, bought: 360, soldFor: 96, introduced: 0 }] }] }) });
  try {
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    await p.work.quiet();
    enter(d, "customers", "associates"); await p.work.quiet();
    /* 16 Nov 2026, the move to Ambient (place H): a book is its section head with its chip and how many; its associates one Table that stacks where there is no room, the reward Ambient's meter */
    /* 1 */
    const heads = [...d.querySelectorAll("#clist h2.aprodhead")];
    ok(heads.length === 2 && J(heads.map((h) => [t(h.querySelector(".aprodtag")), t(h.querySelector(".amb-section__note"))])) === J([["Salt", "1 associate"], ["Oil", "1 associate"]])
      && heads.every((h) => !!h.querySelector(".aprodtag .amb-chip.amb-kind-1, .aprodtag .amb-chip[class*='amb-kind-']")),
      "a book is its chip and how many: " + J(heads.map(t)));
    /* 2 */
    const tables = [...d.querySelectorAll("#clist table.amb-table--stack")];
    const row = tables[0] && [...tables[0].querySelectorAll("tbody tr")[0].children];
    const m = row && row[8].querySelector("progress.amb-meter");
    ok(tables.length === 2 && J(row.slice(0, 5).map(t)) === J(["CX1-ZED", "founder · #1 · ★★★", "RM 2,480.00", "RM 1,150.00", "RM 640.00"]) && t(row[5]) === "3"
      && J([...tables[0].querySelectorAll("thead th")].map(t)) === J(["Associate", "Standing", "Bought", "Sold", "Introduced", "Resales", "Referred", "Share", "Reward, units"])
      && !!m && m.value === 80 && /3 earned, 1 taken, 1.4 left, 80% to next/.test(t(row[8])) && row.every((c) => c.hasAttribute("data-label")) && !tables[1].querySelector("progress")
      && !d.querySelector("#clist .atable table, #clist .salt-table-wrap, #clist .aclist"),
      "an associate is a row of one stacking table, every cell labelled, the reward a meter on salt alone: " + J(row && row.map(t)));
    /* 3 */
    ok(row[0].querySelector("button.amb-pill--quiet") && row[0].querySelector("button").getAttribute("data-act") === "assoc.open-row" && [...tables[0].querySelectorAll("thead th")].slice(2, 8).every((h) => h.classList.contains("is-num")),
      "the code is a small quiet pill that opens the account, the figures right: " + (row && t(row[0])));
    /* 4 */
    await click(d.querySelector('#clist [data-act="assoc.open-row"]'));
    ok(!d.getElementById("oAccts").hidden && !!d.querySelector('#aopen [data-acct="abcd-efgh"]'), "the code opens the associate's account");
  } finally { p.w.close(); }
}
