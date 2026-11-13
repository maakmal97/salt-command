/* test/desk-customers.mjs: THE PRICE BAND'S VERSION 3 ON THE DESK (13 Nov 2026): the customers' panels. Display and reading only; the engine (SNAPSHOT_ENGINE.testOf,
 * testReading, calendarLift, newBuyers, habits) is held by test/price-band-customers.mjs. The suite's frozen book holds the market switch off and the test starts
 * on 16 Nov 2026, so each reading is the engine's answer stubbed on the page, as test/desk-market.mjs does.
 *   K1  the Price test card says this week's test (RM 5 up at 1 unit, week 1 of 8; down in the odd weeks) and "No test today" outside it
 *   K2  its reading gives orders a day and margin a day, up weeks against down weeks, and says estimate where either side has fewer than 7 days
 *   K3  the card is drawn for the book whose rule carries `test`, never by its name: not without the rule
 *   K4  the Calendar draws nothing until /calendar has answered ok, asks once with the keyed headers, and hands the engine his marks
 *   K5  a passed mark reads its lift against the 28 days before (or says there is nothing to measure against); the link adds marks on Salt Admin
 *   K6  a coming mark measured twice says hold N units and the +5 move is his to switch, as information; one measured less says only how often
 *   K7  Clients draws the new buyers (eight weeks: new, through an associate, came back) and says Thin only when the engine says so
 *   K8  Clients lists the regulars due, late or lapsed in the engine's order, each linked to its Salt Admin account, and leaves out those who are early
 *   K3.2 nor the calendar; K8.4 twelve regulars are listed and the rest counted
 *   K9  Clients draws neither for a book whose rule carries no `habit`
 * Every assertion is red under its own mutation (test/desk-customers.mutations.json). */
import { openMaster } from "../tools/payload.mjs";

const J = JSON.stringify;
const text = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");

export async function run({ ok }) {
  const { w } = await openMaster();
  try {
    const d = w.document, E = (s) => w.eval(s);
    const hrefs = (root) => [...root.querySelectorAll("a[href^='admin?to=']")].map((a) => decodeURIComponent(a.getAttribute("href").slice("admin?to=".length)));
    const draw = () => { E("render()"); };

    /* K1 to K3: the Price test */
    E("switchTab('pricing')");
    E("SNAPSHOT_ENGINE.testOf=()=>({q:1,rm:5,week:1,weeks:8,from:'2026-11-16'})");
    E("SNAPSHOT_ENGINE.testReading=()=>({q:1,from:'2026-11-16',weeks:8,up:{days:7,orders:5,ordersDay:0.71,marginDay:31.5},down:{days:7,orders:3,ordersDay:0.43,marginDay:18.25}})");
    draw();
    ok(/^RM 5 up at 1 unit, week 1 of 8$/.test(text(d.getElementById("ckTestNow"))),
      "K1.1 week 1 reads RM 5 up at 1 unit, week 1 of 8: " + J(text(d.getElementById("ckTestNow"))));
    E("SNAPSHOT_ENGINE.testOf=()=>({q:1,rm:-5,week:2,weeks:8,from:'2026-11-16'})");
    draw();
    ok(/^RM 5 down at 1 unit, week 2 of 8$/.test(text(d.getElementById("ckTestNow"))), "K1.2 week 2 reads RM 5 down: " + J(text(d.getElementById("ckTestNow"))));
    E("SNAPSHOT_ENGINE.testOf=()=>null");
    draw();
    ok(text(d.getElementById("ckTestNow")) === "No test today", "K1.3 outside the test it says No test today: " + J(text(d.getElementById("ckTestNow"))));

    const cells = () => [...d.querySelectorAll("#ckTestRead tbody tr")].map((tr) => [...tr.children].map(text));
    ok(J(cells()) === J([["Up", "0.71", "RM 31.50", "7"], ["Down", "0.43", "RM 18.25", "7"]]) && !/estimate/.test(text(d.getElementById("ckTestRead"))),
      "K2.1 seven days of each give the figures with no estimate: " + J(cells()));
    E("SNAPSHOT_ENGINE.testReading=()=>({q:1,from:'2026-11-16',weeks:8,up:{days:7,orders:5,ordersDay:0.71,marginDay:31.5},down:{days:3,orders:1,ordersDay:0.33,marginDay:9}})");
    draw();
    ok(/estimate/.test(text(d.getElementById("ckTestRead"))), "K2.2 three days on one side is an estimate: " + J(text(d.getElementById("ckTestRead"))));
    E("SNAPSHOT_ENGINE.testReading=()=>({q:1,from:'2026-11-16',weeks:8,up:{days:0,orders:0,ordersDay:null,marginDay:null},down:{days:0,orders:0,ordersDay:null,marginDay:null}})");
    draw();
    ok(J(cells()) === J([["Up", "- estimate", "- estimate", "0"], ["Down", "- estimate", "- estimate", "0"]]),
      "K2.3 no days measured shows dashes and the estimate: " + J(cells()));

    const T = E("TIER_RULE.salt.test"), saved = J(T);
    E("delete TIER_RULE.salt.test");
    draw();
    ok(!d.getElementById("ckTest") && !d.getElementById("ckCal"), "K3 a rule with no test draws no test card");
    E("TIER_RULE.salt.test=" + saved);

    /* K4 to K6: the Calendar */
    E("SNAPSHOT_ENGINE.testOf=()=>null");
    let seen = null;
    w.__seen = (marks, p) => { seen = [marks, p]; };
    E(`SNAPSHOT_ENGINE.calendarLift=(C,p,marks)=>{__seen(marks,p);return [
      {name:'Payday',from:'2026-09-25',to:'2026-09-27',passed:true,lift:0.4,perDay:7,measured:2},
      {name:'Raya',from:'2026-03-30',to:'2026-04-02',passed:true,lift:null,perDay:null,measured:0},
      {name:'Payday',from:'2026-11-25',to:'2026-11-27',passed:false,lift:null,perDay:null,measured:2,suggest:{hold:12,move:0.05,lift:0.4}},
      {name:'Sale',from:'2026-12-01',to:'2026-12-01',passed:false,lift:null,perDay:null,measured:1}]}`);
    draw();
    ok(!d.getElementById("ckCal"), "K4.1 nothing of the calendar before the route has answered");
    const calls = [];
    const viaFetch = async (answer) => {
      E("CK_CAL=null;CK_CAL_TRIED=false;cloudMode=()=>true");
      w.fetch = async (url, o) => { calls.push([url, o && o.headers]); return { ok: true, json: async () => answer }; };
      await E("ckCalLoad()");
      draw();
      return d.getElementById("ckCal");
    };
    const refused = await viaFetch({ ok: false, list: [{ id: "a", name: "Payday", from: "2026-09-25", to: "2026-09-27" }] });
    ok(!refused && E("CK_CAL") === null, "K4.2 an answer that is not ok draws no calendar");
    const marks = [{ id: "a", name: "Payday", from: "2026-09-25", to: "2026-09-27" }, { id: "b", name: "Sale", from: "2026-12-01", to: "2026-12-01" }];
    calls.length = 0; seen = null;
    const cal = await viaFetch({ ok: true, list: marks });
    ok(!!cal && calls.length === 1 && calls[0][0] === "calendar" && !!calls[0][1] && J(seen) === J([marks, "salt"]),
      "K4.3 an ok answer draws it, asked once on the keyed route, the marks and the book handed to the engine: " + J([calls.length, calls[0] && calls[0][0], seen]));
    E("render()");
    ok(calls.length === 1, "K4.4 a second draw does not ask again: " + calls.length);

    const li = [...d.querySelectorAll("#ckCalList li")].map(text);
    ok(li.length === 4 && li[0].startsWith("Raya, 30 Mar to 2 Apr: no sales in the 28 days before"), "K5.1 the marks stand in date order, a passed mark with nothing before it says so: " + J(li));
    ok(li[1] === "Payday, 25 to 27 Sep: +40% units a day against the 28 days before", "K5.2 a passed mark reads its lift against the 28 days before: " + J(li[1]));
    ok(J(hrefs(cal)) === J(["shop/calendar"]) && /Add or remove marks/.test(text(cal)), "K5.3 the link adds and removes marks on Salt Admin's calendar: " + J(hrefs(cal)));
    ok(li[2] === "Payday, 25 to 27 Nov: coming, measured 2 times: hold 12 units; a +5 move is his to switch", "K6.1 a coming mark measured twice carries the suggestion: " + J(li[2]));
    ok(li[3] === "Sale, 1 Dec: coming, measured 1 time" && !/hold/.test(li[3]), "K6.2 a coming mark measured once carries no suggestion: " + J(li[3]));
    ok(/information only/.test(text(cal)), "K6.3 the card says a suggestion is information only: " + J(text(cal)));

    E("delete TIER_RULE.salt.test");
    draw();
    ok(!d.getElementById("ckCal"), "K3.2 a rule with no test draws no calendar either, though the marks have answered");
    E("TIER_RULE.salt.test=" + saved);

    /* K7 to K9: Clients */
    const wk = (i, c, n, b) => ({ from: "2026-09-" + String(10 + i).padStart(2, "0"), to: "x", count: c, introduced: n, back: b });
    const weeks = [3, 2, 4, 1, 2, 3, 0, 1].map((c, i) => wk(i, c, i % 2, c > 1 ? 1 : 0));
    E(`SNAPSHOT_ENGINE.newBuyers=()=>({weeks:${J(weeks)},mean:2,thin:false})`);
    const hab = (code, state, since, gap) => ({ code, regular: true, state, since, gap, usual: 1, margin30: 40, owes: 0 });
    E(`SNAPSHOT_ENGINE.habits=()=>${J([hab("CA1-AA", "lapsed", 40, 9), hab("CB2-BB", "late", 20, 10), hab("CC3-CC", "due", 12, 11), hab("CD4-DD", "early", 3, 14)])}`);
    E("switchTab('concentration')");
    draw();
    const nbRows = [...d.querySelectorAll("#ckBuyers tbody tr")].map((tr) => [...tr.children].map(text));
    ok(nbRows.length === 8 && J(nbRows[0]) === J(["10 Sep", "3", "0", "1"]) && J(nbRows[1]) === J(["11 Sep", "2", "1", "1"]) && /16 new in eight weeks, 2 a week\./.test(text(d.getElementById("ckBuyersLine"))),
      "K7.1 eight weeks of new, through an associate, came back, and the total and mean: " + J([nbRows.length, nbRows[0], nbRows[1], text(d.getElementById("ckBuyersLine"))]));
    ok(!/Thin/.test(text(d.getElementById("ckBuyers"))), "K7.2 no Thin when the engine does not say so");
    E(`SNAPSHOT_ENGINE.newBuyers=()=>({weeks:${J(weeks)},mean:2,thin:true})`);
    draw();
    ok(/Thin: each of the last two weeks ran under half that/.test(text(d.getElementById("ckBuyersLine"))), "K7.3 Thin when the engine says so: " + J(text(d.getElementById("ckBuyersLine"))));

    const hrows = [...d.querySelectorAll("#ckHabits tbody tr")];
    ok(J(hrows.map((r) => r.dataset.c)) === J(["CA1-AA", "CB2-BB", "CC3-CC"]) && J(hrows.map((r) => text(r.children[1]))) === J(["lapsed", "late", "due"])
      && J(hrows.map((r) => text(r.children[2]))) === J(["40", "20", "12"]) && J(hrows.map((r) => text(r.children[3]))) === J(["9 d", "10 d", "11 d"]),
      "K8.1 the lapsed, late and due in the engine's order with days since and the usual gap, none early: " + J(hrows.map((r) => text(r))));
    ok(J(hrefs(d.getElementById("ckHabits"))) === J(["acct/CA1-AA", "acct/CB2-BB", "acct/CC3-CC"]), "K8.2 each links to its account on Salt Admin: " + J(hrefs(d.getElementById("ckHabits"))));
    E(`SNAPSHOT_ENGINE.habits=()=>${J([hab("CD4-DD", "early", 3, 14)])}`);
    draw();
    ok(/Nobody is due, late or lapsed/.test(text(d.getElementById("ckHabits"))) && !d.querySelector("#ckHabits tbody"), "K8.3 with everybody early it says nobody needs a word: " + J(text(d.getElementById("ckHabits"))));

    const many = Array.from({ length: 14 }, (_, i) => hab("CZ" + i + "-ZZ", "lapsed", 40 - i, 9));
    E(`SNAPSHOT_ENGINE.habits=()=>${J(many)}`);
    draw();
    ok(d.querySelectorAll("#ckHabits tbody tr").length === 12 && text(d.getElementById("ckHabMore")) === "2 more, furthest first.",
      "K8.4 twelve are listed and the rest counted: " + J([d.querySelectorAll("#ckHabits tbody tr").length, text(d.getElementById("ckHabMore"))]));

    E("delete TIER_RULE.salt.habit");
    draw();
    ok(!d.getElementById("ckBuyers") && !d.getElementById("ckHabits"), "K9 a rule with no habit draws neither");
  } finally { w.close(); }
}
