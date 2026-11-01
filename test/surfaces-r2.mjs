/* test/surfaces-r2.mjs (1 Nov 2026, the surfaces pass's next pass, his word "Yes, next pass"): faults the round 2 audit confirmed
 * on the Desk and on Salt Admin, each driven in the page as served. Each check is red under its own mutation
 * (test/surfaces-r2.mutations.json).
 *   D1  a queued Cancellation the Desk's overlay declines (a sale that has delivered, a lot that has arrived) leaves the row's trail
 *       as it was, as the Default branch does; it wrote the Cancellation step first, so History drew a closed line
 *   D2  To do's cash act reads the credit an Accept spent: an order its credit covers owes nothing, as Salt Admin and the Counter say
 *   D3  a tap on a rail tab's count opens that tab (the count had no data-s, so the tap did nothing)
 *   D4  an Analysis link to a ledger row opens the older fold and clears the filters, so a row older than seven days is reached
 *   A1  Record's Try again reads again after a failed read (the box kept its read mark, so the retry returned at once)
 *   A2  a redraw of an account while This customer is still being read draws it once the read lands (the new box waited for nothing)
 * Invented codes only. */
import { openMaster } from "../tools/payload.mjs";
import { richOwnerPage, byAct, enter } from "./maker-act.mjs";

const J = JSON.stringify;

export async function run({ ok, pageWork }) {
  const { w } = await openMaster(process.env.SALT_MASTER || undefined);
  try {
    w.eval("setProd('salt');recompute();if(!HTMLElement.prototype.scrollIntoView)HTMLElement.prototype.scrollIntoView=function(){};");
    /* D1 */
    w.eval("sales.push({rid:'r2-cxs',date:'2026-10-01',customer:'CY2-NIL',qty:2,total:200,cost:100,cash:0,deliveredQty:1});"
      + "purchases.push({rid:'r2-cxb',date:'2026-10-01',supplier:'SY2-NIL',qty:5,total:250,cash:250,receivedQty:5,status:'paid'});recompute();provNotes=[];");
    w.eval("ovAmend({kind:'Cancellation',date:'2026-10-06',direction:'SELL',rid:'r2-cxs'},{at:'x1'});ovAmend({kind:'Cancellation',date:'2026-10-06',direction:'BUY',rid:'r2-cxb'},{at:'x2'});");
    const d1 = JSON.parse(String(w.eval("JSON.stringify({s:sales.find(function(r){return r.rid==='r2-cxs';}),b:purchases.find(function(r){return r.rid==='r2-cxb';}),n:provNotes})")));
    const cx = (r) => ((r && r.amend) || []).filter((a) => a.kind === "Cancellation").length;
    ok(cx(d1.s) === 0 && cx(d1.b) === 0 && !d1.s.cancelled && !d1.b.cancelled && d1.n.filter((x) => /was not applied/.test(x)).length === 2,
      "D1: a cancellation the overlay declines leaves no Cancellation step on the sale's or the lot's trail: " + J({ sale: d1.s.amend, lot: d1.b.amend, notes: d1.n }));

    /* D2 */
    const acts = (o) => JSON.parse(String(w.eval("JSON.stringify((function(){ORD_OPEN=" + J([o]) + ";AP_DRAFTS=[];return ordActs().map(function(a){return a.kind;});})())")));
    const handed = { id: "20261101090000-r2cr", u: "abcd-efgh", code: "CY2-NIL", status: "ready", mode: "collect", product: "salt", qty: 1, total: 100, delivery: 0, paid: 0,
      moved: 1, movedAt: "2026-11-01T09:00:00Z", at: "2026-11-01T08:00:00Z", history: [], msgs: [], payments: [] };
    const covered = acts({ ...handed, credit: 100 }), part = acts({ ...handed, credit: 25 }), none = acts(handed);
    ok(!covered.includes("cash") && part.includes("cash") && none.includes("cash"),
      "D2: an order its credit covers asks for no cash on To do, and one it covers in part still does: " + J({ covered, part, none }));

    /* D3 */
    const d3 = String(w.eval("(function(){switchTab('today');var b=document.querySelector('#tabs [data-s=\"money\"]');if(!b)return 'no Money tab';"
      + "var c=b.querySelector('.navct');if(!c){c=document.createElement('span');c.className='navct salt-rail__count';c.textContent='3';b.appendChild(c);}"
      + "c.dispatchEvent(new MouseEvent('click',{bubbles:true}));return curTab;})()"));
    ok(d3 === "money", "D3: a tap on a rail tab's count opens that tab: " + d3);

    /* D4 */
    const d4 = String(w.eval("(function(){var s=sales.filter(function(x){return x.rid&&x.date;}).sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0;})[0];if(!s)return 'no row';"
      + "ledOlder=false;ledF={q:'zz-none-zz',state:'',party:'',month:'',product:''};goRid(s.rid);"
      + "return s.date+':'+(document.querySelector('.lcard[data-rid=\"'+s.rid+'\"]')?'drawn':'absent');})()"));
    ok(/:drawn$/.test(d4), "D4: an Analysis link reaches a ledger row older than seven days behind a filter: " + d4);
  } finally {
    await new Promise((r) => setTimeout(r, 200));
    try { w.close(); } catch (e) { /* jsdom */ }
  }

  /* A1 */
  {
    const p = await richOwnerPage({ pageWork, failRoutes: ["/all/maker/inputs"] });
    try {
      const d = p.d, quiet = async () => { await p.work.quiet(); await p.work.quiet(); };
      await quiet();
      enter(d, "record"); await quiet();
      const retry = byAct(d, "record.retry"), before = p.wire.filter((x) => x.startsWith("/all/maker/inputs GET")).length;
      p.fail.delete("/all/maker/inputs");
      if (retry) retry.click();
      await quiet();
      const after = p.wire.filter((x) => x.startsWith("/all/maker/inputs GET")).length, box = d.getElementById("makerInputs");
      ok(!!retry && after === before + 1 && !byAct(d, "record.retry") && !!box && !!box.querySelector(".maker-input"),
        "A1: Record's Try again reads again after a failed read and draws the forms: " + J({ retry: !!retry, before, after, forms: box ? box.querySelectorAll(".maker-input").length : -1 }));
    } finally { try { p.w.close(); } catch (e) { /* jsdom */ } }
  }

  /* A2 */
  {
    const cust = { customer: true, code: "CX1-ZED", rates: [{ rate: 120 }, { rate: 115 }, { rate: 110 }], unitNow: 110, highest: 120, cadence: { every: 9, orders: 4 }, dueIn: 2,
      loyal: { units: 7, every: 20, paused: false }, cost: 56, held: 0, suggest: { pct: 0, why: "" } };
    let land = null;
    const held = new Promise((resolve) => { land = () => resolve({ ok: true, reading: cust }); });
    const p = await richOwnerPage({ pageWork,
      inputsAnswer: (j) => ({ ...j, catalog: { ...j.catalog, products: [{ product: "salt", drift: true, saleReady: true }], driftCustomers: ["CX1-ZED"], partners: [], partnerWaiting: [],
        driftCards: [{ code: "CX1-ZED", product: "salt", held: false, value: null, current: 0, suggest: null, why: "" }] } }),
      extra: (route) => route === "/all/maker/customer-of/CX1-ZED" ? held : route === "/all/maker/reward-of/CX1-ZED" ? { ok: true, reading: {} } : undefined });
    try {
      const d = p.d, t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : ""), quiet = async () => { await p.work.quiet(); await p.work.quiet(); };
      await quiet();
      enter(d, "customers", "accounts"); await quiet();
      const row = () => [...d.querySelectorAll("#rlist [data-u]")].find((c) => t(c.querySelector(".need-who")) === "CX1-ZED");
      /* the read is held open on purpose, so a short pause, never quiet(), which would wait it out */
      if (row()) row().click(); await new Promise((r) => setTimeout(r, 80));
      const first = d.querySelector("#aopen .acust");
      if (row()) row().click(); await new Promise((r) => setTimeout(r, 80));
      const second = d.querySelector("#aopen .acust");
      land(); await quiet();
      const now = d.querySelector("#aopen .acust");
      ok(!!first && !!second && first !== second && !!now && !now.hidden && /RM/.test(t(now)),
        "A2: an account drawn again while This customer is read shows it once the read lands: " + J({ redrawn: first !== second, hidden: now ? now.hidden : null, text: t(now).slice(0, 80) }));
    } finally { try { p.w.close(); } catch (e) { /* jsdom */ } }
  }
}
