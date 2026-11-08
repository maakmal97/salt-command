/* test/desk-paths.mjs: EVERY CONCLUSION LEADS TO THE CORRECT PATH (9 Nov 2026, his word: each ledger row and each conclusion on Salt Desk leads where it
 * should, one distinct and simple workflow for every action; his answer: Show, then act). Show opens exactly what a conclusion names, on the Desk; Act opens
 * the one Salt Admin place where it is decided, through the Desk's /admin and a fixed list of addresses. Each check red under its own mutation
 * (test/desk-paths.mutations.json); invented codes only where a fixture names a party (rule 2).
 *   P1  goRows: the Ledger shows the rows named and no other, says so in its bar, and Clear shows every row again
 *   P2  goParty: the Ledger shows that party's rows alone (its own party filter)
 *   P3  a ledger row carries Change on Salt Admin to its own sale form (admin?to=row/<rid>), shown only with its trail, and a tap on it never folds the trail
 *   P4  a Noticed card that names rows shows them (The N rows), one that does not opens its page, and every card's Hide opens that reminder on Salt Admin
 *   P5  the six findings that name rows (twins, no cost, undated, stale pending, same-day trail, under the floor) each carry their rows
 *   P6  To do: a chase shows their rows and records on their oldest unpaid row; a refund shows their rows and is marked paid on their account; the orders
 *       waiting row opens Needs you; a lot to buy is entered on Record
 *   W1  /admin?to= lands on a listed address only; anything else lands on Approve
 *   A1  Salt Admin: #row/<rid> opens that row in the sale form, and Back leaves it rather than opening it again
 *   A2  Salt Admin: #acct/<code> opens that account's card
 *   A3  Salt Admin: #tip/<id> opens Desk reminders with that reminder chosen
 *   A4  Salt Admin: an address it does not list opens nothing */
import { openMaster } from "../tools/payload.mjs";
import { adminRedirect, ADMIN_TO } from "../src/worker.js";
import { richOwnerPage, byAct } from "./maker-act.mjs";

const J = JSON.stringify;
const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");

export async function run({ ok, pageWork }) {
  const { w } = await openMaster();
  try {
    const d = w.document, ev = (s) => w.eval(s);
    const cards = () => [...d.querySelectorAll(".ledwrap .lcard")];
    const reset = () => ev("ledF={q:'',state:'',party:'',month:'',product:''};ledOlder=false");
    /* P1 */
    reset(); ev("ledOlder=true"); w.switchTab("ledger");
    const all = cards().map((c) => c.dataset.rid), two = [all[3], all[all.length - 5]];
    w.goRows(two.join(" "), "the finding names");
    const shown = cards().map((c) => c.dataset.rid), bar = d.querySelector(".ledrids");
    const clr = d.getElementById("ledClear"); if (clr) clr.click();
    const back = cards().length;
    ok(J(shown.sort()) === J(two.slice().sort()) && /^The 2 rows the finding names\. Clear shows every row\.$/.test(t(bar)) && back === all.length - 0 && ev("ledF.rids") === undefined,
      "P1 goRows shows the rows named and no other, says so, and Clear shows every row again: " + J([shown, two, t(bar), back, all.length]));
    /* P2 */
    reset(); w.switchTab("ledger");
    const who = ev("sales.find(s=>s.customer&&!/-R$/.test(s.customer)).customer"), theirs = ev(`sales.filter(s=>s.customer===${J(who)}).length+purchases.filter(p=>p.supplier===${J(who)}).length`);
    w.goParty(who);
    const pc = cards(), parties = [...new Set(pc.map((c) => t(c.querySelector(".lparty"))))];
    ok(pc.length === theirs && parties.length === 1 && ev("ledF.party") === who,
      "P2 goParty shows that party's rows alone: " + J([who, pc.length, theirs, parties]));
    /* P3 */
    reset(); ev("ledOlder=true"); w.switchTab("ledger");
    const c0 = cards()[0], link = c0 && c0.querySelector(".lchange a");
    const css = [...d.styleSheets].flatMap((s) => [...s.cssRules]).filter((r) => r.selectorText).map((r) => r.selectorText.replace(/\s+/g, " ") + "{" + r.style.cssText + "}").join(" ");
    const was = c0.classList.contains("lexp");
    if (link) link.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));
    ok(!!link && link.getAttribute("href") === "admin?to=" + encodeURIComponent("row/" + c0.dataset.rid) && link.getAttribute("target") === "_blank"
      && /\.ledwrap \.lcard \.lchange\{display: none;\}/.test(css) && /\.ledwrap \.lcard\.lexp \.lchange\{display: flex;/.test(css)
      && c0.classList.contains("lexp") === was && ADMIN_TO.test("row/" + c0.dataset.rid),
      "P3 a ledger row carries Change on Salt Admin to its own sale form, shown with its trail, and its tap leaves the trail as it was: " + J([link && link.getAttribute("href"), was, c0.classList.contains("lexp")]));
    /* P4 */
    const withRows = w.obsCard({ id: "int:fixture", sev: "note", conf: "measured", rows: ["s001", null, "s002"], tab: "ledger", title: "T", why: "W" });
    const noRows = w.obsCard({ id: "rhythm:dow:salt", sev: "note", conf: "measured", tab: "analysis", title: "T", why: "W" });
    ok(/data-rows="s001 s002" onclick="goRows\(this\.dataset\.rows,'the finding names'\)">The 2 rows &rarr;<\/button>/.test(withRows)
      && /onclick="switchTab\('analysis'\)">Analysis &rarr;/.test(noRows) && !/data-rows/.test(noRows)
      && /href="admin\?to=tip%2Fint%3Afixture" target="_blank" rel="noopener">Hide on Salt Admin &rarr;<\/a>/.test(withRows) && !/Hush on Salt Admin/.test(withRows),
      "P4 a card naming rows shows them, one naming none opens its page, and every card's Hide opens that reminder on Salt Admin: " + J([withRows.slice(withRows.indexOf("obsact")), noRows.slice(noRows.indexOf("obsact"))]));
    /* P5: the book raises twins and no cost; a stale pending order, an undated delivery, a same-day trail and a sale under the floor are put on its copy */
    reset();
    ev(`sales.push({rid:'s990',customer:'CQ1-ZED',qty:1,total:100,date:'2026-10-01'},
      {rid:'s991',customer:'CQ2-ZED',qty:1,total:100,cash:10,deliveredQty:1,date:'2026-10-02'},
      {rid:'s992',customer:'CQ3-ZED',qty:1,total:100,cash:100,deliveredQty:1,date:'2026-10-03',amend:[{date:'2026-10-03',kind:'Fulfilment',kg:1,cash:100}]},
      {rid:'s993',customer:'CQ5-ZED',qty:5,total:10,cash:10,deliveredQty:5,date:TODAY.toISOString().slice(0,10),deliveredOn:TODAY.toISOString().slice(0,10),paidOn:TODAY.toISOString().slice(0,10)})`);
    const O = ev("observations().all");
    const fam = (re) => O.filter((o) => re.test(o.id));
    const has = (re, rid) => fam(re).length > 0 && fam(re).every((o) => Array.isArray(o.rows) && o.rows.length > 0 && (!rid || o.rows.includes(rid)));
    const got = { dup: has(/^dup:/), nocost: has(/^int:nocost$/), under: has(/^int:underfloor$/, "s993"), stale: has(/^int:stalepend$/, "s990"), undated: has(/^int:undated$/, "s991"), trail: has(/^int:samedaytrail$/, "s992") };
    ok(Object.values(got).every(Boolean), "P5 the six findings that name rows each carry their rows: " + J(got));
    ev("sales.splice(sales.length-4,4)");
    /* P6 */
    ev(`customerRefunds.push({party:'CQ4-ZED',amount:25,since:'2026-11-01'})`);
    ev(`window.ordWaiting=()=>({placed:[{}],asked:[],acts:[{kind:'new'}],rm:110})`);
    const A = ev("actions()");
    const chase = A.find((x) => x.kind === "collect" && x.party), refund = A.find((x) => x.kind === "pay" && x.party === "CQ4-ZED"), orders = A.find((x) => x.kind === "orders"), buy = A.find((x) => x.kind === "buy");
    const oldest = chase && ev(`(()=>{const ds=arList.filter(s=>s.customer===${J(chase.party)}&&outstandingOf(s)>0.009).map(s=>({s,held:txUnpaidSince(s)?dAge(txUnpaidSince(s)):null,age:dAge(s.date)})).sort(byHeld);return ridOf(ds[0].s);})()`);
    ok(!!chase && J(chase.admin) === J(["row/" + oldest, "Record it on Salt Admin"]) && !!refund && J(refund.admin) === J(["acct/CQ4-ZED", "Mark it paid on Salt Admin"])
      && !!orders && J(orders.admin) === J(["needs", "Needs you on Salt Admin"]) && (!buy || J(buy.admin) === J(["record/entry", "Enter the lot on Salt Admin"]))
      && [chase, refund, orders].concat(buy ? [buy] : []).every((x) => ADMIN_TO.test(x.admin[0])),
      "P6 To do's chase, refund, orders waiting and lot to buy each open their Salt Admin place: " + J([chase && chase.admin, oldest, refund && refund.admin, orders && orders.admin, buy && buy.admin]));
    w.switchTab("today");
    const row = [...d.querySelectorAll(".sec.on .salt-action")].find((a) => a.querySelector('[data-party]'));
    const go = row && [...row.querySelectorAll(".salt-action__go button, .salt-action__go a")].map((b) => t(b) + (b.getAttribute("href") ? " " + b.getAttribute("href") : ""));
    ok(!!go && go.some((x) => x === "Their rows →") && go.some((x) => /^Record it on Salt Admin → admin\?to=row%2F[slp]\d+$/.test(x)),
      "P6 a chase row draws Their rows and Record it on Salt Admin: " + J(go));
  } finally { w.close(); }

  /* W1 */
  const env = { ADMIN_URL: "https://site.test/all" }, loc = (to) => { const r = adminRedirect(env, to); return r.status === 302 ? new URL(r.headers.get("location")).hash : r.status; };
  const good = ["needs", "orders/ledger", "customers/accounts", "record/pricing", "row/s346", "acct/CM4-TO-R", "tip/dup:CS6-BS-R:2026-09-16:2026-09-19:420"];
  const bad = [null, "", "orders/evil", "row/s1/x", "row/x1", "acct/CX1 ZED", "tip/<b>", "javascript:alert(1)", "//evil.test", "needs/x"];
  ok(good.every((g) => loc(g) === "#" + g) && bad.every((b) => loc(b) === "#orders/approve"),
    "W1 /admin?to= lands on a listed address only, anything else on Approve: " + J([good.map(loc), bad.map(loc)]));

  /* A1 to A4: Salt Admin opened at each address */
  const catalogWith = (j) => { j.catalog.rows = [{ rid: "s901", party: "CX1-ZED", product: "salt", date: "2026-09-01", qty: 2, total: 200, direction: "SELL", cash: 0, movedUnits: 0, delivery: 0, handover: "collected" }];
    j.catalog.tips = [{ id: "tip-0", title: "Another tip", hush: null }, { id: "tip-1", title: "A tip", hush: null }]; return j; };
  const at = async (hash) => { const p = await richOwnerPage({ pageWork, hash, inputsAnswer: catalogWith, probe: true }); await p.work.quiet(); return p; };
  let p = await at("#row/s901");
  try {
    const f = p.d.querySelector('#makerInputs section.maker-input[data-form="sale-or-purchase"]'), pick = f && byAct(f, "record.trade.edit");
    const shownF = (() => { for (let e = f; e && e.id !== "roster"; e = e.parentElement) if (e.hidden) return false; return !!f; })();
    const hist = p.w.history.length, addr = p.w.location.hash;
    ok(!!pick && pick.value === "s901" && shownF && addr === "#record" && !/row/.test(addr),
      "A1 #row/<rid> opens that row in the sale form, its own address replaced so Back leaves it: " + J([pick && pick.value, shownF, addr, hist]));
  } finally { p.w.close(); }
  p = await at("#acct/CX1-ZED");
  try {
    ok(p.w.__owner("aOpen") === "abcd-efgh" && p.w.__owner("placeNow+'/'+partNow") === "customers/accounts",
      "A2 #acct/<code> opens that account's card: " + J([p.w.__owner("aOpen"), p.w.__owner("placeNow+'/'+partNow")]));
  } finally { p.w.close(); }
  p = await at("#acct/CX1-ZED-R");
  try {
    ok(p.w.__owner("aOpen") === "abcd-efgh", "A2 a -R bucket's code opens its associate's account, the bucket having none: " + J(p.w.__owner("aOpen")));
  } finally { p.w.close(); }
  p = await at("#tip/tip-1");
  try {
    const f = p.d.querySelector('#makerInputs section.maker-input[data-form="desk-reminders"]'), pick = f && byAct(f, "record.tip.tip");
    ok(!!pick && pick.value === "tip-1" && p.w.__owner("fOpen") === "desk-reminders" && p.w.__owner("placeNow+'/'+partNow") === "record/pricing",
      "A3 #tip/<id> opens Desk reminders with that reminder chosen: " + J([pick && pick.value, p.w.__owner("fOpen"), p.w.__owner("placeNow+'/'+partNow")]));
  } finally { p.w.close(); }
  p = await at("#row/zz9");
  try {
    ok(p.w.__owner("placeNow") === "needs" && p.w.__owner("amendWant") === null && p.w.__owner("fOpen") === null,
      "A4 an address Salt Admin does not list opens nothing: " + J([p.w.__owner("placeNow"), p.w.__owner("fOpen")]));
  } finally { p.w.close(); }
}
