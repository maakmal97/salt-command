/* test/admin-cust-pct.mjs: SALT ADMIN CUSTOMERS, P3 AND P4, WHAT PRICES A CUSTOMER ON THEIR CARD (26 Oct 2026; his yes to Asks A, B and G). Each check is red
 * under its own mutation (test/admin-cust-pct.mutations.json):
 *   1  Their % stands on the account: a book a tab, the suggestion and why, the stepper at what is set, Send at that % off while nothing changes,
 *      Use the suggestion
 *   2  the stepper moves in whole steps of 5 between -30% and +30%, and their prices at the new % are the Desk's preview, against the Floor
 *   3  Send sends one tier-set at that %, as a fraction, and nothing else; Use the suggestion fills it; Set back to 0 sends a null
 *   4  a book with nothing set and no suggestion offers neither Use nor Set back to 0
 *   5  This customer and the associate reward are read by the account's code and drawn on the card: the figures, the meter, the step
 *   6  Make partner asks once: the first tap sends nothing, the second sends the partner entry
 *   7  Record > Pricing keeps Printed sizes and has no Their % or partner form
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct, enter } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;

export async function run({ ok, pageWork }) {
  const preview = (code, book, whole) => ({ code, held: -0.1, pct: whole / 100, rows: [
    { q: 1, now: 110, at: Math.max(60, 120 + whole), floor: 60, usual: true }, { q: 5, now: 440, at: Math.max(300, 460 + 4 * whole), floor: 300 }] });
  const cust = { customer: true, code: "CX1-ZED", rates: [{ rate: 120 }, { rate: 115 }, { rate: 110 }], unitNow: 110, highest: 120, cadence: { every: 9, orders: 4 }, dueIn: 2,
    loyal: { units: 7, every: 20, paused: false }, cost: 56, held: -0.1, suggest: { pct: -0.15, why: "good record" } };
  const rwd = { associate: true, times: 10, rate: 56, step: 560, progress: 380, given: 15, net: 41, unit: null };
  const p = await richOwnerPage({ pageWork,
    inputsAnswer: (j) => ({ ...j, catalog: { ...j.catalog,
      products: [{ product: "salt", drift: true, saleReady: true }, { product: "oil", drift: true, saleReady: true }],
      driftCustomers: ["CX1-ZED"], partners: [], partnerWaiting: [],
      driftCards: [{ code: "CX1-ZED", product: "salt", held: true, value: -0.1, current: -0.1, suggest: -0.15, why: "good record" }, { code: "CX1-ZED", product: "oil", held: false, value: null, current: 0, suggest: null, why: "" }] } }),
    extra: (route) => {
      const m = /^\/all\/maker\/drift-preview\/([A-Z0-9-]+)\/([a-z]+)\/(-?\d+)$/.exec(route);
      if (m) return { ok: true, preview: preview(m[1], m[2], +m[3]) };
      if (route === "/all/maker/customer-of/CX1-ZED") return { ok: true, reading: cust };
      if (route === "/all/maker/reward-of/CX1-ZED") return { ok: true, reading: rwd };
      return undefined;
    } });
  try {
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); await p.work.quiet(); };
    await p.work.quiet();
    enter(d, "customers", "accounts"); await p.work.quiet();
    const open = async (code) => { await click([...d.querySelectorAll("#rlist [data-u]")].find((c) => t(c.querySelector(".need-who")) === code)); return d.querySelector("#aopen .oacct"); };
    let a = await open("CX1-ZED");
    if (!d.querySelector("#aopen .apct") || !d.querySelector("#aopen .acust")) { ok(false, "the account carries Their % and This customer"); return; }
    const pct = () => d.querySelector("#aopen .apct"), btn = (act) => byAct(pct(), act, act === "acct.pct.send" || act === "acct.pct.clear" ? "CX1-ZED" : undefined) || byAct(pct(), act);
    /* 1 */
    const tabs = [...pct().querySelectorAll('[data-act="acct.pct.book"]')];
    const sug = [...pct().querySelectorAll(".salt-ledger__row")].map(t);
    ok(!!pct() && pct().classList.contains("salt-glass-card") && J(tabs.map(t)) === J(["Salt", "Oil"]) && tabs[0].getAttribute("aria-selected") === "true" && !!tabs[0].querySelector(".salt-producttag")
      && J(sug) === J(["Suggested−15%Good record"]) && t(pct().querySelector(".apct__val")) === "−10%" && t(btn("acct.pct.send")) === "Send −10%" && btn("acct.pct.send").disabled
      && t(btn("acct.pct.suggest")) === "Use −15%" && !btn("acct.pct.suggest").disabled && !!btn("acct.pct.clear"),
      "Their % stands on the account: the books as tabs, the suggestion and why, the stepper at what is set, Send off while unchanged: " + J([tabs.map(t), sug, t(pct().querySelector(".apct__val"))]));
    /* 2 */
    const reads0 = p.wire.length;
    await click(btn("acct.pct.down"));
    const rows = () => [...pct().querySelectorAll(".apct__table tbody tr")].map((r) => [...r.children].map(t).join("|"));
    ok(t(pct().querySelector(".apct__val")) === "−15%" && t(btn("acct.pct.send")) === "Send −15%" && !btn("acct.pct.send").disabled
      && J([...pct().querySelectorAll(".apct__table thead th")].map(t)) === J(["Units", "Now", "At −15%", "Floor"]) && J(rows()) === J(["1 unit|RM 110|RM 105|RM 60", "5 units|RM 440|RM 400|RM 300"])
      && p.wire.slice(reads0).some((w) => w.startsWith("/all/maker/drift-preview/CX1-ZED/salt/-15 GET")),
      "a step moves 5 and their prices are the Desk's preview at the new %, against the Floor: " + J(rows()));
    for (let i = 0; i < 4; i++) await click(btn("acct.pct.down"));
    ok(t(pct().querySelector(".apct__val")) === "−30%" && btn("acct.pct.down").disabled && !btn("acct.pct.up").disabled, "the stepper stops at −30%");
    for (let i = 0; i < 3; i++) await click(btn("acct.pct.up"));
    /* 3 */
    p.posts.length = 0;
    await click(btn("acct.pct.send"));
    const tier = p.posts.filter((x) => x.route === "/all/maker/inputs/tier-set");
    ok(tier.length === 1 && tier[0].body.code === "CX1-ZED" && tier[0].body.product === "salt" && tier[0].body.tier === -0.15 && tier[0].body.unit === "pct" && typeof tier[0].body.at === "string" && p.posts.length === 1,
      "Send sends one tier-set at that %, as a fraction, and nothing else: " + J(p.posts));
    a = await open("CX1-ZED");
    await click(btn("acct.pct.down")); await click(btn("acct.pct.suggest"));
    ok(t(pct().querySelector(".apct__val")) === "−15%", "Use the suggestion fills the stepper: " + t(pct().querySelector(".apct__val")));
    p.posts.length = 0;
    await click(btn("acct.pct.clear"));
    ok(p.posts.length === 1 && p.posts[0].route === "/all/maker/inputs/tier-set" && p.posts[0].body.tier === null && p.posts[0].body.product === "salt", "Set back to 0 sends a null: " + J(p.posts));
    /* 4 */
    await click(pct().querySelectorAll('[data-act="acct.pct.book"]')[1]);
    ok(pct().querySelectorAll('[data-act="acct.pct.book"]')[1].getAttribute("aria-selected") === "true" && t(pct().querySelector(".apct__val")) === "0%" && btn("acct.pct.suggest").disabled
      && t(btn("acct.pct.suggest")) === "No suggestion" && !byAct(pct(), "acct.pct.clear", "CX1-ZED") && t(pct().querySelector(".salt-ledger__row")) === "SuggestedNone",
      "a book with nothing set offers neither Use nor Set back to 0");
    /* 5 */
    const c = d.querySelector("#aopen .acust"), r = d.querySelector("#aopen .arwd");
    const lines = (box) => [...box.querySelectorAll(".salt-ledger__line")].map((l) => t(l.children[0]) + "=" + t(l.children[1]));
    ok(!!c && !c.hidden && t(c.querySelector("h3")) === "This customer" && J(lines(c)) === J(["A unit now=RM 110", "Highest=RM 120", "Orders every=9 days", "Next order due=in 2 days"])
      && /Loyalty 7 of 20 units/.test(t(c.querySelector(".salt-meter"))) && c.querySelector(".salt-meter").style.getPropertyValue("--salt-fill") === "35" && !!c.querySelector("svg.acust__spark")
      && p.wire.some((w) => w.startsWith("/all/maker/customer-of/CX1-ZED GET")),
      "This customer is read by the account's code and drawn: " + J(lines(c)));
    ok(!!r && !r.hidden && t(r.querySelector("h3")) === "Associate reward" && J(lines(r)) === J(["Step, 10 units’ cost=RM 560", "Given under Set Price=RM 15", "A unit, net to you=RM 41"])
      && r.querySelector(".salt-meter").style.getPropertyValue("--salt-fill") === "68" && p.wire.some((w) => w.startsWith("/all/maker/reward-of/CX1-ZED GET")),
      "the associate reward is read by code and drawn: " + J(lines(r)));
    /* 6 */
    const mk = byAct(d.getElementById("aopen"), "acct.partner", "CX1-ZED");
    p.posts.length = 0;
    await click(mk);
    const first = p.posts.length, said = t(mk);
    await click(mk);
    ok(first === 0 && said === "Tap again: send to Approve" && p.posts.length === 1 && p.posts[0].route === "/all/maker/inputs/partner" && p.posts[0].body.code === "CX1-ZED",
      "Make partner asks once, then sends the partner entry: " + J([first, said, p.posts]));
    /* 7 */
    enter(d, "record", "pricing"); await p.work.quiet();
    ok(!d.querySelector('[data-act^="record.drift"]') && !d.querySelector('[data-act^="record.partner"]') && !!d.querySelector('[data-act="record.house.send"]'),
      "Record > Pricing keeps Printed sizes and has no Their % or partner form");
  } finally { p.w.close(); }
}
