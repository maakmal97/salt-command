/* test/desk-cleanup.mjs: THE DESK CLEANUP AND ITS TWO PLANNERS (10 Nov 2026, his word: fix the bugs, keep only what is worth showing, and
 * make the Desk more interactive for planning; his answers: remove the repeats, the Restock planner and Month ahead, inputs on this device).
 * Plan: docs/plan-desk-cleanup.html. Every check reads what the Desk draws or computes on the frozen book, never the source's text.
 *   F1  a debt past its term is one card: the credit rules it breaks ride on its Chase card as chips, and no Rule card repeats it
 *   F2  a partner's open sale at the Floor is no Margin floor breach; the same sale to anyone else still is
 *   F3  Noticed: one customer card a book, rhythm only where it changes buying, no repeat order, At stake each figure once (11 Nov 2026)
 *   F4  with a live price already under the Floor, no card says the buying rate "can rise" by a negative figure
 *   F5  Rules says a party over a cap once, however many of its rows are over it
 *   F6  Financials' Gross margin is the sum of the books' own, never a dash because one row states no cost
 *   F7  a row corrected twice in a day draws one Correction line for that day
 *   F8  Analysis holds only the last correction of a field against its row, and counts a shelf truly empty, never one rebuilt under zero
 *   C1  Rules holds its register alone; Today no Money at stake chart; Financials no unmeasured line; Sourcing one gap tile; Associates no empty fold
 *   C2  Clients' Their % is one line counted off TIER_OF with the link to Salt Admin; Associates says a departure and a vacancy in one line
 *   L1-L5 one P&L: the year is the operating profit, freight and non-revenue in their months, no IFRS fold (12 Nov 2026)
 *   S1-S4 Stock's On hand: non-revenue at the P&L's rate, the reconciliation in totals, the repeat fold gone (12 Nov 2026)
 *   P1  the plan store is this device's, clamped on every read, and garbage reads as nothing
 *   P2  a what-if lot lands in its book's inventory and leaves the cash on its day, is said to be a what-if, and books nothing
 *   P3  Month ahead: demand moves revenue, the buying cost the cost of goods, running costs what is left; the first column never moves
 *   P4  a stepper stops at its end
 * Every assertion is red under its own mutation (test/desk-cleanup.mutations.json). */
import { openMaster } from "../tools/payload.mjs";

const J = JSON.stringify;
const text = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");

export async function run({ ok }) {
  const { w } = await openMaster();
  try {
    const d = w.document, E = (s) => w.eval(s);
    const html = (part) => { const el = d.createElement("div"); el.innerHTML = E(`builders[${J(part)}]()`); return el; };

    /* F1 */
    const acts = E("allActions().map(x=>({sev:x.sev,kind:x.kind,party:x.party||'',title:String(x.title),why:String(x.why)}))");
    const credit = E("(function(){const o={};Object.values(eachBook(()=>boundaryScan().filter(x=>x.sev==='breach'&&/^Credit /.test(x.rule)).map(x=>x.who))).forEach(L=>L.forEach(w=>{o[w]=1;}));return Object.keys(o)})()");
    const chased = acts.filter((a) => a.kind === "collect" && a.sev === "now" && credit.includes(a.party));
    ok(chased.length > 0 && chased.every((a) => a.sev === "now" && /class="rchip"/.test(a.why)),
      "F1.1 a chase for a party breaking a credit rule stands at Now and carries the rule as a chip: " + J(chased.map((a) => [a.party, a.sev, /rchip/.test(a.why)])));
    const rules = acts.filter((a) => a.kind === "rule");
    ok(chased.length > 0 && !rules.some((r) => !/Margin|Banned|ban/i.test(r.why) && chased.some((c) => r.title.includes(c.party)) && !/rchip">(?!Credit )/.test(r.why)),
      "F1.2 no Rule card repeats a debt its Chase card already carries: " + J(rules.map((r) => r.title.replace(/<[^>]+>/g, ""))));

    /* F2: every open sale read as priced exactly at its cost and at its Floor (the readers stubbed, the book untouched), its buyer a
       partner and then not: at the Floor a partner keeps rule 5, anyone else is at cost and breaches */
    const f2 = E(`(function(){
      const keep=[txUnitCost,floorTotal,isPartner];
      const scan=part=>{txUnitCost=s=>txPrice(s);floorTotal=()=>0;isPartner=()=>part;
        try{return boundaryScan().filter(x=>x.rule==='Margin floor'&&x.sev==='breach'&&x.who&&x.who!==NIL).length;}
        finally{txUnitCost=keep[0];floorTotal=keep[1];isPartner=keep[2];}};
      const loss=(()=>{txUnitCost=s=>txPrice(s)*1.2;floorTotal=()=>0;isPartner=()=>true;
        try{return boundaryScan().filter(x=>x.rule==='Margin floor'&&x.sev==='breach'&&x.who&&x.who!==NIL).length;}
        finally{txUnitCost=keep[0];floorTotal=keep[1];isPartner=keep[2];}})();
      return {partner:scan(true),stranger:scan(false),loss};})()`);
    ok(f2.stranger > 0 && f2.partner === 0, "F2.1 a partner's open sale at the Floor breaks no margin rule, and anyone else's at cost still does: " + J(f2));

    ok(f2.loss > 0, "F2.2 a partner's sale under its own lot's cost is a loss and still a breach: " + J(f2));

    /* F3 (11 Nov 2026, his three answers): Noticed draws one customer card a book, rhythm only where it changes buying, no repeat order.
       Synthetic items through noticedDraw, so every branch is driven whatever the book holds today; then the page itself. */
    const nd = (live, hushed = []) => E(`noticedDraw(${J(live)},${J(hushed)}).map(o=>({id:o.id,sev:o.sev,title:o.title,why:o.why,rm:o.rm}))`);
    const it = (id, sev, title, why = "w", rm = 0) => ({ id, fam: "x", sev, title, why, rm, conf: "measured" });
    const syn = nd([it("cust:cadence:salt", "watch", "13 customers are past their own habit on salt", "split", 1912),
      it("promo:revive:salt", "note", "Three messages are worth about RM 853 on salt", "CA2, CJ4, CH4 lead", 853),
      it("cust:cadence:oil", "watch", "6 customers are past their own habit on oil", "split", 374),
      it("promo:revive:rice", "note", "Two messages are worth about RM 50 on rice", "CI5 lead", 50),
      it("dup:CX1:2026-01-01:2026-01-03:90", "note", "CX1 bought the same thing twice in 2 days"), it("cust:oneanddone", "note", "17 of 53 bought once"),
      it("rhythm:payday:salt", "note", "The pay window runs level with mid-month"), it("rhythm:holiday:salt", "note", "Next holiday 44 days out"),
      it("rhythm:restock:salt", "note", "The next fortnight looks ordinary"), it("rhythm:restock:oil", "watch", "Buy about 12% more"),
      it("rhythm:dow:salt", "note", "Friday is the busiest day", "Friday 2.30."), it("rhythm:weekend:salt", "watch", "Weekends run quieter", "28% less."),
      it("int:nocost", "watch", "4 priced sales carry no cost")], [it("cust:cadence:candy", "watch", "hushed")].concat([]));
    const sid = syn.map((o) => o.id), s1 = syn.find((o) => o.id === "cust:cadence:salt") || {};
    ok(!sid.some((i) => /^dup:|oneanddone/.test(i)), "F3.1 no repeat order and no 'bought once' is drawn: " + J(sid));
    ok(!sid.includes("promo:revive:salt") && s1.sev === "watch" && s1.rm === 1912 && s1.title === "13 customers are past their own habit on salt: three messages are worth about RM 853"
      && /^CA2, CJ4, CH4 lead /.test(s1.why) && sid.includes("cust:cadence:oil") && sid.includes("promo:revive:rice"),
      "F3.2 a book's habit card carries its message card, its own id, watch and figure; a message card with no habit card stands alone: " + J(s1));
    const hz = nd([it("promo:revive:candy", "note", "Two messages are worth RM 9 on candy")], [it("cust:cadence:candy", "watch", "hushed")]);
    ok(hz.length === 0, "F3.3 a message card whose habit card is hushed goes with it: " + J(hz));
    ok(!sid.some((i) => /^rhythm:(payday|holiday):/.test(i) || i === "rhythm:restock:salt") && sid.includes("rhythm:restock:oil"),
      "F3.4 the pay window, a holiday and the fortnight draw only when they reach watch: " + J(sid.filter((i) => /^rhythm/.test(i))));
    const dw = syn.find((o) => o.id === "rhythm:dow:salt") || {};
    ok(!sid.includes("rhythm:weekend:salt") && dw.sev === "note" && /Friday 2\.30\. Weekends run quieter: 28% less\./.test(dw.why),
      "F3.5 the weekday pattern is one note, the weekend beside it: " + J(dw));
    E("switchTab('today')");
    const nt = d.querySelector("#sec-today details.noticed"), drawn = E("(function(){const X=observations();return noticedDraw(X.live,X.hushed).map(o=>({sev:o.sev,rm:o.rm||0}))})()");
    const stk = [...nt.querySelectorAll(".salt-kpi")].find((k) => /At stake/.test(text(k.querySelector(".salt-kpi__label"))));
    const stakeWant = drawn.reduce((a, o) => a + (o.sev !== "note" && o.rm > 0.009 ? o.rm : 0), 0);
    const all = E("observations().live.reduce((a,o)=>a+(o.rm>0.009?o.rm:0),0)");
    ok(text(stk.querySelector(".salt-kpi__value")) === E(`fmt0(${stakeWant})`) && stakeWant < all && +text(nt.querySelector(":scope > summary .ct")) === drawn.length
      && nt.querySelectorAll("details.obs").length === drawn.length && !/Tags:/.test(text(nt)),
      "F3.6 At stake is what Act and Watch name, each once, the count is the cards drawn, and no tag legend: " + J([text(stk), stakeWant, all, drawn.length]));
    /* a note that names a figure is drawn but at stake it is not: one invented note of RM 999 beside today's items */
    const noteStake = E(`(function(){const keep=observations;observations=function(){const X=keep();
      return Object.assign({},X,{live:X.live.concat([{id:'promo:test:salt',fam:'promo',sev:'note',conf:'measured',rm:999,tab:'pricing',title:'a note with a figure',why:'w'}])});};
      try{const e=document.createElement('div');e.innerHTML=tabPlans();const k=[...e.querySelectorAll('.salt-kpi')].find(x=>/At stake/.test(x.querySelector('.salt-kpi__label').textContent));
        return [k.querySelector('.salt-kpi__value').textContent.trim(),!!/a note with a figure/.test(e.textContent)];}finally{observations=keep;}})()`);
    ok(noteStake[0] === text(stk.querySelector(".salt-kpi__value")) && noteStake[1], "F3.7 a note's figure is drawn on its card and left out of At stake: " + J(noteStake));

    /* F4: the walk answering a live price already under the Floor */
    const f4 = E(`(function(){const keep=boardHeadroom;
      boardHeadroom=()=>({live:50,safeTo:49,headroom:-1,pct:-2,firstTier:'X',firstAt:50,hits:[],unbounded:false});
      const all=()=>{const X=observations();return X.live.concat(X.hushed);};
      const neg=all().filter(o=>/^px:headroom/.test(o.id)).length;
      boardHeadroom=()=>({live:50,safeTo:53,headroom:3,pct:6,firstTier:'X',firstAt:54,hits:[],unbounded:false});
      const pos=all().filter(o=>/^px:headroom/.test(o.id)).map(o=>o.title);
      boardHeadroom=keep;return {neg,pos};})()`);
    ok(f4.neg === 0 && f4.pos.length >= 1 && /can rise/.test(f4.pos[0]),
      "F4.1 a headroom under nought raises no card, one over it still does: " + J(f4));

    /* F5 */
    const over = [...html("overview").querySelectorAll(".pchip")].map(text).filter((t) => /over the/.test(t));
    const rowsOver = E("Math.max(0,...Object.values(eachBook(()=>{const n={};arList.filter(s=>overCap(s)).forEach(s=>{n[s.customer]=(n[s.customer]||0)+1;});return Math.max(0,...Object.values(n));})))");
    ok(rowsOver >= 2 && over.length > 0 && over.every((t) => (t.match(/over the/g) || []).length <= E("PROD_IDS.length") && !/(over the [^·]+ cap) · \1/.test(t)),
      "F5.1 a party with " + rowsOver + " rows over one cap is said over it once: " + J(over));

    /* F6 */
    const f6 = E("(function(){const G=eachBook(()=>grossMargin);return {nul:consoMoney().margin==null,sum:Object.values(G).reduce((a,x)=>a+(+x||0),0),fmt:fmt0(Object.values(G).reduce((a,x)=>a+(+x||0),0))};})()");
    const tile = [...html("financials").querySelectorAll(".conso .kpi")].find((k) => text(k.querySelector(".salt-kpi__label")) === "Gross margin");
    ok(f6.nul && f6.sum > 0 && !!tile && text(tile.querySelector(".salt-kpi__value")) === f6.fmt.replace(/&nbsp;/g, " "),
      "F6.1 with a book stating no cost on a row, the business's Gross margin is still the books' own added: " + J([f6, tile && text(tile.querySelector(".salt-kpi__value"))]));

    /* F7 */
    const twice = E("sales.filter(s=>s.rid&&(()=>{const n={};(s.amend||[]).filter(a=>a.kind==='Correction'&&!a.undone).forEach(a=>{const k=String(a.date).slice(0,10);n[k]=(n[k]||0)+1;});return Object.values(n).some(v=>v>1);})()).map(s=>s.rid)");
    E("switchTab('ledger')"); E(`goRows(${J(twice.join(" "))},'the check names')`);
    const cards = [...d.querySelectorAll("#sec-book .lcards > *")];
    const repeats = cards.map((c) => { const L = [...c.querySelectorAll(".ltext")].map((x) => x.innerHTML).filter(Boolean); return L.length - new Set(L).size; });
    ok(twice.length > 0 && cards.length >= twice.length && repeats.every((n) => n === 0),
      `F7.1 ${twice.length} rows corrected twice in a day each draw a day's changes once: ` + J([cards.length, repeats]));

    /* F8 */
    E("switchTab('analysis')");
    const rev = [...d.querySelectorAll("#sec-book .pend.def tbody tr")].map((r) => text(r.children[0]) + ":" + text(r.children[2]).split(" ")[0]);
    ok(rev.length > 0 && new Set(rev).size === rev.length && !rev.some((k) => /:note$/.test(k)),
      "F8.1 the review holds one line a row's field, its last correction: " + J(rev));
    const f8 = E("eachBook(()=>{const sh=stockHistory();return [sh.filter(r=>r.lvl<-0.05).length,sh.filter(r=>Math.abs(r.lvl)<=0.05).length];})");
    const book = Object.keys(f8).find((p) => f8[p][0] > 0);
    E(`setProdView(${J(book || "salt")})`); E("switchTab('analysis')");
    const dry = [...d.querySelectorAll("#sec-book .kpi")].find((k) => /empty inventory/.test(text(k.querySelector(".salt-kpi__label"))));
    ok(!!book && !!dry && +text(dry.querySelector(".salt-kpi__value")) === f8[book][1],
      "F8.2 a day rebuilt under zero is not a day with an empty shelf: " + J([book, f8[book || "salt"], dry && text(dry.querySelector(".salt-kpi__value"))]));
    E("setProdView('salt')");
    /* a note amended is prose, never a figure held against the row: every corrected row made to claim one */
    const f83 = E(`(function(){const keep=modClaims;
      modClaims=(t,dir)=>keep(t,dir).concat(keep(t,dir).some(c=>c.verdict)?[{on:'2026-01-01',field:'note',was:'a',now:'b',reads:'c',verdict:'differs'}]:[]);
      try{const el=document.createElement('div');el.innerHTML=tabAnalysis();return [...el.querySelectorAll('.pend.def tbody tr')].filter(r=>/^note /.test(r.children[2].textContent.trim())).length;}
      finally{modClaims=keep;}})()`);
    ok(f83 === 0, "F8.3 a note's prose is never held against its row: " + f83);

    /* C1 */
    const ov = html("overview"), heads = [...ov.querySelectorAll("h2,.cardh")].map(text);
    ok(!!ov.querySelector(".kpi") === false && !heads.some((h) => /digest|at a glance|Latest ledger/i.test(h)) && /Boundaries/.test(heads.join("|")),
      "C1.1 Rules is its register, with no digest, glance or ledger of another page: " + J(heads));
    E("switchTab('today')");
    ok(!d.getElementById("tdKindChart") && !!d.getElementById("tdCoverChart"), "C1.2 Today draws Cover and no Money at stake chart");
    const fin = html("financials");
    ok(!/not measured/.test(fin.textContent) && !/Per order, whatever the size|Every month, whether anything sells/.test(fin.textContent),
      "C1.3 Financials carries no line that measures nothing");
    const src = html("sourcing"), labels = [...src.querySelectorAll(".salt-kpi__label")].map(text);
    ok(labels.includes("The gap") && !labels.some((l) => /^Lost to (leakage|price|both)/.test(l)), "C1.4 Sourcing says the gap once: " + J(labels.filter((l) => /gap|Lost|revenue/i.test(l))));
    const nw = html("network");
    ok(nw.querySelectorAll("details.obsec").length > 0 && ![...nw.querySelectorAll("details.obsec")].some((f) => /^(0|none)$/.test(text(f.querySelector("summary .ct"))) || text(f.querySelector(".card")) === "None."),
      "C1.5 Associates draws no fold that holds nothing");

    /* C2 (11 Nov 2026, his answers "off the Desk" and "one line"): Clients draws no table of every customer's %, one line counting who
       holds one (read off TIER_OF itself) and who the engine suggests another, with the link to Salt Admin's accounts; a book where nobody
       holds one says so; Associates says the departure and the vacancy in one line under the tree, and draws no card for either */
    E("setProd('salt');recompute();");
    const cl = html("concentration"), pl = text(cl.querySelector("#pctLine"));
    const want = E(`(function(){const ids=tierCustomers().filter(id=>partners.indexOf(id)<0);
      const held=ids.filter(id=>{const o=TIER_OF[ownerOf(id)||id];return !!o&&typeof o.salt==='number';}).length;
      const sugg=ids.filter(id=>{const g=suggestOf(id,'salt'),dr=driftOf(id,'salt');return !!g&&Math.abs(g.pct||0)>0.0001&&Math.abs(g.pct-(dr.d||0))>0.0001;}).length;
      return [held,ids.length,sugg];})()`);
    ok(!cl.querySelector(".tiertab") && !/what it quotes/.test(text(cl)) && pl === `On salt, ${want[0]} of ${want[1]} hold a % you set and ${want[2]} ${want[2] === 1 ? "is" : "are"} suggested another.`
      && want[0] > 0 && !!cl.querySelector('a[href="admin?to=customers%2Faccounts"]'),
      "C2.1 Clients draws one Their % line, counted off TIER_OF, and the link to Salt Admin, never a row a customer: " + J([pl, want, cl.querySelectorAll("tr").length]));
    /* a suggestion equal to the % they already hold is no suggestion: every customer stubbed to hold +10% and be suggested +10% */
    const same = E(`(function(){const kd=driftOf,ks=suggestOf;driftOf=()=>({hand:0.1,d:0.1});suggestOf=()=>({pct:0.1});
      try{const e=document.createElement('div');e.innerHTML=pctLine();return e.querySelector('#pctLine').textContent;}finally{driftOf=kd;suggestOf=ks;}})()`);
    ok(/ and 0 are suggested another\.$/.test(same), "C2.4 a suggestion equal to the % they hold is not counted: " + J(same));
    E("setProd('gas');recompute();");
    const glp = text(html("concentration").querySelector("#pctLine"));
    E("setProd('salt');recompute();");
    ok(glp === "Nobody holds a % on gas, and none is suggested.", "C2.2 a book where nobody holds a % says so: " + J(glp));
    const nw2 = html("network"), st = text(nw2.querySelector("#nwStand"));
    const dep2 = E("PEOPLE.departed.map(b=>b.id+' left '+b.since)"), vac2 = E("PEOPLE.roles.filter(r=>!r.holder).map(r=>r.short||r.title)");
    ok(!nw2.querySelector(".pend") && dep2.length > 0 && vac2.length > 0 && dep2.every((c) => st.includes(c))
      && st.includes("the " + vac2[0] + " seat is open since") && /DEPARTED/.test(text(nw2)),
      "C2.3 Associates says the departure and the vacancy in one line, draws no card for either, and the tree still marks the departed: " + J([st, dep2, vac2]));

    /* L1 to L5 (12 Nov 2026, his answer "one P&L"): the monthly table carries freight in and non-revenue, each in its month, so the
       year is the operating profit ifrsPL states; the IFRS fold is gone and its value test is one row under Inventory */
    const plOf = (p) => E(`(function(){setProdView(${J(p)});const F=ifrsPL(${J(p)});const e=document.createElement('div');e.innerHTML=tabFinancials();
      const rows=[...e.querySelectorAll('table.pgrid tr')].map(r=>[...r.children].map(c=>c.textContent.trim()));
      const cy=l=>{const r=rows.find(x=>x[0].indexOf(l)===0);return r?r[r.length-1]:null;};
      return {op:cy('Operating profit'),opWant:fmt0(F.opProfit).replace(CUR+' ',''),frt:cy('Freight in'),frtWant:F.freightCos>0.004?fmt0(-F.freightCos).replace(CUR+' ',''):NIL,
        nrv:cy('Lower of cost'),ifrs:/Statement of profit or loss/.test(e.textContent),text:e.textContent};})()`);
    const books = E("PROD_IDS"), pls = books.map((p) => [p, plOf(p)]);
    ok(pls.every(([, r]) => r.op === r.opWant), "L1 every book's year is the operating profit: " + J(pls.map(([p, r]) => [p, r.op, r.opWant])));
    ok(pls.every(([, r]) => r.frt === r.frtWant) && /Freight in.{0,40}typed on \d+ lots?/.test(pls[0][1].text), "L2 freight in is charged on the units sold, the year its whole: " + J(pls.map(([p, r]) => [p, r.frt, r.frtWant])));
    ok(pls.every(([, r]) => !r.ifrs && /^(cost|written down by .+|untested)$/.test(r.nrv || "")), "L3 the IFRS fold is gone and its value test is one row: " + J(pls.map(([p, r]) => [p, r.ifrs, r.nrv])));
    const nm = E(`(function(){setProdView('salt');const N=nrsMonths('salt');const s=Object.values(N.by).reduce((a,v)=>a+v,0);return {sum:+s.toFixed(2),selfUse,pin:N.pin,neg:Object.values(N.by).some(v=>v<-0.009)};})()`);
    const saltText = pls.find(([p]) => p === "salt")[1].text;
    ok(Math.abs(nm.sum - nm.selfUse) < 0.011 && (Math.abs(nm.pin) > 0.009) === / the counts do not date sits in the latest/.test(saltText),
      "L4 the months add to the shortfall Stock reads, and the part the counts do not date is said: " + J(nm));
    const none = E(`(function(){const keep=COUNTS.slice();COUNTS.length=0;try{setProdView('salt');const F=ifrsPL('salt');const e=document.createElement('div');e.innerHTML=tabFinancials();
      const r=[...e.querySelectorAll('table.pgrid tr')].map(x=>[...x.children].map(c=>c.textContent.trim())).find(x=>x[0].indexOf('Non-revenue')===0);
      const o=[...e.querySelectorAll('table.pgrid tr')].map(x=>[...x.children].map(c=>c.textContent.trim())).find(x=>x[0].indexOf('Operating profit')===0);
      return {cy:r[r.length-1],want:fmt0(-F.nonRev).replace(CUR+' ',''),months:r.slice(1,-1).every(c=>c===NIL),said:/no count states a figure/.test(r[0]),op:o[o.length-1],opWant:fmt0(F.opProfit).replace(CUR+' ','')};}finally{COUNTS.push(...keep);}})()`);
    ok(none.cy === none.want && none.months && none.said && none.op === none.opWant, "L5 with no count holding a figure the year carries non-revenue alone, and says so: " + J(none));
    /* L6: the walk on invented counts and lots. A 25-unit lot landed after the 31 Oct count is read after it; a lot ordered 10 Oct and
       landed 5 Nov is dated by its landing; a count after today is left out; what the counts leave (25 against 20) sits in the latest month */
    const syn6 = E(`nrsMonths(PROD,{counts:[{date:'2026-09-30',qty:90,product:PROD},{date:'2026-10-31',qty:80,product:PROD},{date:'2026-11-15',qty:155,product:PROD},{date:'2099-01-01',qty:0,product:PROD}],
      logs:[],lots:[{date:'2026-09-01',u:100},{date:'2026-10-31',u:25},{date:'2026-10-10',receivedOn:'2026-11-05',u:50}],sales:[],op:0,total:25,recv:x=>x.u,now:'2026-11-20'})`);
    ok(J(syn6.by) === J({ "2026-09": 10, "2026-10": 10, "2026-11": 5 }) && syn6.pin === 5,
      "L6 a same-day lot after its count, a lot dated by its landing, a count after today, and the residual in the latest month: " + J(syn6));
    const pinSaid = E(`(function(){const k=nrsMonths;nrsMonths=()=>({by:{},pin:5,last:'2026-11-15'});try{const e=document.createElement('div');e.innerHTML=tabFinancials();return / the counts do not date sits in the latest/.test(e.textContent);}finally{nrsMonths=k;}})()`);
    ok(pinSaid === true, "L6.2 the part the counts do not date is said on the row");
    E("setProdView('salt')");

    /* S1 to S4 (12 Nov 2026, Stock's On hand, his answers "totals, lots once" and "cut the repeat, keep the method") */
    const oh = E(`JSON.stringify(PROD_IDS.map(function(p){setProdView(p);const F=ifrsPL(p);const e=document.createElement('div');e.innerHTML=builders.inventory();
      const T=x=>x.textContent.trim();const k=[...e.querySelectorAll('.salt-kpi')].find(x=>T(x.querySelector('.salt-kpi__label')).indexOf('Non-revenue')===0);
      const rec=[...e.querySelectorAll('details.obsec')].find(d=>T(d.querySelector('summary')).indexOf('Inventory reconciliation')===0);
      const lots=[...e.querySelectorAll('details.obsec')].find(d=>T(d.querySelector('summary')).indexOf('Lots and sourcing')===0);
      const rows=rec?[...rec.querySelectorAll('tbody tr')].map(r=>[...r.children].map(T)):[];
      const att=[...e.querySelectorAll('.stkwrap tr.tot')].map(r=>[...r.children].map(T)).find(r=>r[0]==='Attributed');
      const su=selfUseLog.filter(r=>(r.product||DEFAULT_PROD)===p).reduce((a,r)=>a+r.kg,0);
      return {p,tile:k?T(k.querySelector('.salt-kpi__value'))+'|'+T(k.querySelector('.salt-kpi__note')):'',want:fmt0(F.nonRev),
        recv:rows.filter(r=>/^Received/.test(r[0])).map(r=>r[0]),lots:lots?lots.querySelectorAll('tbody tr').length:0,lotsWant:receivedPO.length+1+defaultPO.length+pPurch(p).filter(x=>poOpenUnits(x)>0.0001&&poLive(x)).length,
        sum:+rows.filter(r=>/^[+-]/.test(r[1])).reduce((a,r)=>a+parseFloat(r[1].replace(/[^0-9.+-]/g,'')),0).toFixed(2),onHand:currentStock,
        att:att?att[2]:null,attWant:su>0?fmt0(su*F.unitCost):null,repeat:/Why each loss is booked where it is/.test(e.textContent),method:/How it is measured/.test(e.textContent)===!restockFor(p).empty};}))`);
    const ohs = JSON.parse(oh);
    ok(ohs.every((x) => (x.tile.split("|")[1] || "").indexOf("≈ " + x.want + " at ") === 0) && ohs.some((x) => x.want !== "RM 0"),
      "S1 the non-revenue tile on every book says the figure the P&L charges: " + J(ohs.map((x) => [x.p, x.tile.split("|")[1], x.want])));
    ok(ohs.filter((x) => x.attWant).every((x) => x.att === x.attWant) && ohs.some((x) => x.attWant), "S2 the shrinkage card values each loss at the P&L's rate: " + J(ohs.map((x) => [x.p, x.att, x.attWant])));
    ok(ohs.every((x) => x.recv.length <= 1 && (!x.recv.length || /^Received, \d+ lots?$/.test(x.recv[0])) && Math.abs(x.sum - x.onHand) < 0.011),
      "S3 the reconciliation is totals, one Received line, and it adds to what is on hand: " + J(ohs.map((x) => [x.p, x.recv, x.sum, x.onHand])));
    ok(ohs.every((x) => !x.repeat && x.method && x.lots === x.lotsWant), "S4 the repeat fold is gone, the method fold stays, and Lots and sourcing lists every lot: " + J(ohs.map((x) => [x.p, x.repeat, x.method, x.lots, x.lotsWant])));
    E("setProdView('salt')");

    /* P1 */
    w.localStorage.removeItem("salt-plan-v1");
    const p0 = E("planGet()");
    w.localStorage.setItem("salt-plan-v1", J({ dem: 999, cost: -7, run: -5, lots: [{ prod: "nope", qty: 1, rate: 1, day: 0 }, { prod: "salt", qty: -1, rate: 5, day: 0 }, { prod: "salt", qty: 2, rate: 5, day: 99 }, { prod: "salt", qty: 2.5, rate: 56, day: 3 }] }));
    const p1 = E("planGet()");
    w.localStorage.setItem("salt-plan-v1", "{not json");
    const p2 = E("planGet()");
    ok(J(p0) === J({ dem: 0, cost: 0, run: 0, lots: [] }) && J(p2) === J(p0) && p1.dem === 50 && p1.cost === -5 && p1.run === 0 && J(p1.lots) === J([{ prod: "salt", qty: 2.5, rate: 56, day: 3 }]),
      "P1.1 the plan reads as nothing until set, and a stored value out of range is brought inside it: " + J([p0, p1, p2]));
    w.localStorage.removeItem("salt-plan-v1");

    /* P2 */
    E("switchTab('forward')");
    const before = E("(function(){const A=fwdAll();return {end:A.cash.cashEnd,dry:A.per.salt.f.dry,last:A.per.salt.f.rows[A.per.salt.f.rows.length-1].inventory,buys:purchases.length,sales:sales.length,q:queue.length};})()");
    const def = E("planLotDefaults().salt");
    d.querySelector("#whatIf button[onclick=\"planLotQuick('salt')\"]").click();
    const after = E("(function(){const A=fwdAll();return {end:A.cash.cashEnd,dry:A.per.salt.f.dry,base:A.per.salt.base.dry,first:A.per.salt.f.rows[0].inventory-A.per.salt.base.rows[0].inventory,buys:purchases.length,sales:sales.length,q:queue.length,lots:planGet().lots};})()");
    ok(after.lots.length === 1 && after.lots[0].qty === def.qty && Math.abs(after.first - def.qty) < 0.011 && after.base === before.dry && (after.dry == null || after.dry >= before.dry),
      "P2.1 a what-if lot lands in its own book's inventory, beside the book's own reading: " + J([def, before, after]));
    ok(Math.abs((before.end - after.end) - def.qty * def.rate) < 0.011, "P2.2 and leaves the cash by what it costs: " + J([before.end, after.end, def.qty * def.rate]));
    const sec = text(d.querySelector("#sec-stock"));
    ok(/What if, not the book/.test(sec) && /a what-if lot/.test(sec) && /A what-if lot paid for/.test(sec) && /was /.test(sec) === (after.dry !== before.dry),
      "P2.3 the page says which figures are a what-if, and what the book read without it");
    ok(after.buys === before.buys && after.sales === before.sales && after.q === before.q && J(Object.keys(E("(function(){const o={};for(let i=0;i<localStorage.length;i++)o[localStorage.key(i)]=1;return o;})()")).filter((k) => /plan/.test(k))) === J(["salt-plan-v1"]),
      "P2.4 nothing is bought, sold or queued by it: " + J([before, after.buys, after.sales, after.q]));
    d.querySelector("#whatIf button[onclick=\"planLotDrop(0)\"]").click();
    const gone = E("(function(){const A=fwdAll();return [A.cash.cashEnd,A.per.salt.f.dry,planGet().lots.length];})()");
    ok(J(gone) === J([before.end, before.dry, 0]), "P2.5 removed, the forecast is the book's again: " + J(gone));

    E(`planSet({lots:Array.from({length:12},()=>({prod:'salt',qty:1,rate:50,day:1}))})`);
    const full = [...d.querySelectorAll("#whatIf button[onclick^='planLotQuick'], #whatIf button[onclick='planLotAdd()']")];
    ok(full.length > 1 && full.every((b) => b.disabled) && E("planGet().lots.length") === 12, "P2.6 at twelve lots the page takes no more: " + J(full.map((b) => b.disabled)));
    E("planSet({lots:[]})");

    /* P3 */
    const m0 = E("planMonth({dem:0,cost:0,run:0,lots:[]})"), m1 = E("planMonth({dem:20,cost:10,run:300,lots:[]})");
    const near = (a, b) => Math.abs(a - b) < 0.01;
    ok(m0.books.length > 0 && m0.base.rev > 0 && near(m1.base.rev, m0.base.rev) && near(m1.base.cogs, m0.base.cogs) && near(m1.plan.rev, m0.base.rev * 1.2),
      "P3.1 demand moves the second column's revenue and never the first: " + J([m0.base.rev, m1.base.rev, m1.plan.rev]));
    ok(near(m1.plan.cogs, m0.base.cogs * 1.2 * 1.1), "P3.2 the buying cost moves the cost of goods on the units demand leaves: " + J([m0.base.cogs, m1.plan.cogs]));
    ok(near(m1.plan.net, m1.plan.margin - 300) && near(m1.base.net, m1.base.margin - 300) && near(m0.base.net, m0.base.margin),
      "P3.3 running costs come off what is left in both columns: " + J([m1.plan.margin, m1.plan.net, m1.base.net]));
    E("switchTab('financials')"); E("planSet({dem:20,cost:10,run:300})");
    const card = d.getElementById("monthAhead"), even = Math.ceil(300 / m1.plan.perOrder);
    ok(!!card && new RegExp("^" + even + " orders? a month").test(text(card.querySelector(".insight"))) && text(d.getElementById("plan-dem")) === "+20%" && text(d.getElementById("plan-cost")) === "+10%",
      "P3.4 the card says the steps and how many orders cover the running costs: " + J(card && [text(card.querySelector(".insight")), even]));

    /* P4 */
    E("planSet({dem:50,cost:-30})");
    const ends = [...d.querySelectorAll("#monthAhead .salt-stepper .salt-orb")].map((b) => b.disabled);
    E("planStep('dem',10)"); E("planStep('cost',-5)");
    const held = E("[planGet().dem,planGet().cost]");
    ok(J(ends) === J([false, true, true, false]) && J(held) === J([50, -30]), "P4.1 a stepper greys at its end and steps no further: " + J([ends, held]));
    E("planReset()");
    ok(J(E("planGet()")) === J({ dem: 0, cost: 0, run: 0, lots: [] }) && !d.querySelector("#monthAhead button[onclick=\"planReset()\"]"), "P4.2 Reset puts the month back as the book runs");
  } finally { w.close(); }
}
