/* engine/snapshot.mjs: S1c-ii of the Book plan. THE COST GLUE THE PRICING SNAPSHOT NEEDS, PURE.
   These readers sat in the master's script and read its globals (PROD, TODAY, the book consts, pxOver, the walk's outputs), so only
   a desk in jsdom could build the Worker's PRICING. They take everything explicitly now, and the master's functions of the same
   names are one-line delegations (tools/engine.mjs inlines this file after the pricing engine, the import lines dropped; the
   engines are the globals of the same names there).

   C is the context every reader takes: { B, R, today, W, over }.
     B  the book: sales, purchases, opening (by book), statedStockBy, statedStock, loanDrawUnits() (a function: only salt reads it),
        supplierReceivable, counts, selfUseLog, quotes, priceSet, costRule, defaultProd
     R  the rules: COST_BASIS, SHRINK_ATTRIB, PRICE_LOCK, PRICE_ENGINE, LADDER_BY, TIER_RULE (all in engine/rules.mjs),
        and LADDER, PRICE and PRICE_LOCK_ON (S1e), all in engine/rules.mjs
     today  a Date, the page-load clock in the desk
     W  what the walk of the book in view gave: buyUnits, selfUse, wavgBuy, stockCost. In the desk these are its globals, read as they
        stand (recompute() has run for that book); here figures() walks the book itself
     over  { cost, shrink }, the desk's pxOver; null reads as no override
   No module-level state and no cache: the master keeps stockCostFor's and renderMemo's.

   ORDERING, reproduced: the desk's recompute() walks a book with wavgBuyPrev = the wavgBuy of the book walked BEFORE it. That value
   only prices goodwillRM, which nothing here reads, so figures() walks with 0 and every figure is the same (the section proves it). */
import POSITION_ENGINE from "./position.mjs";
import PRICING_ENGINE from "./pricing.mjs";

const SNAPSHOT_ENGINE=(function(){
const pSales=(B,p)=>B.sales.filter(r=>((r&&r.product)||B.defaultProd)===p);
const pPurch=(B,p)=>B.purchases.filter(r=>((r&&r.product)||B.defaultProd)===p);
const openingFor=(B,p)=>B.opening[p]||{qty:0,costPerKg:null,stated:null,uncounted:true};
const dAge=(C,d)=>POSITION_ENGINE.dayAge(C.today,d);
const byDate=(a,b)=>{const x=a.receivedOn||a.date,y=b.receivedOn||b.date;if(!x||!y)return (!x&&!y)?0:(!x?1:-1);return x<y?-1:x>y?1:0;};

function countedFor(B,k){
  if(B.statedStockBy[k]!=null)return B.statedStockBy[k];
  const o=openingFor(B,k);
  if(o&&o.stated!=null)return o.stated;
  return k===B.defaultProd?B.statedStock:null;
}
function posInputs(C,P){
  const B=C.B,_isSalt=(P===B.defaultProd);
  return {sales:pSales(B,P), purchases:pPurch(B,P), opening:openingFor(B,P), isSalt:_isSalt,
    loanUnits:_isSalt?B.loanDrawUnits():0, counted:countedFor(B,P), today:C.today,
    supplierReceivable:(_isSalt&&B.supplierReceivable!=null)?B.supplierReceivable:null,
    refunds:B.refunds||[],   /* 27 Oct 2026: money received by book is cash less the refunds on the row (bookCash) */
    wavgBuyPrev:C.W.wavgBuy};
}
function stockCost(C,p){return POSITION_ENGINE.walk(posInputs(C,p)).stockCost;}

/* the sizes: the walk grid, the printed rungs, a book's own ladder and its stated prices */
function hiddenFor(C,P){
  const e=C.B.priceSet?C.B.priceSet[P]:null;
  return (e&&Array.isArray(e.hide))?e.hide.map(Number):[];
}
function setPricesFor(C,P){
  const e=C.B.priceSet?C.B.priceSet[P]:null;
  return (e&&e.prices)?e.prices:{};
}
function sizesFor(C,P){
  const S=C.R.PRICE_ENGINE.sizesBy||{};
  const all=(S[P]||S[C.B.defaultProd]||C.R.PRICE_ENGINE.sizes).slice();
  const hid=hiddenFor(C,P);
  const out=all.filter(q=>!hid.some(h=>Math.abs(h-q)<0.009));
  return out.length?out:all;                 // hiding every size would leave no board at all
}
function shownSizes(C,P){
  const B=(C.R.PRICE_ENGINE.boardBy||{})[P], all=sizesFor(C,P);
  if(!Array.isArray(B)||!B.length)return all;
  const out=all.filter(q=>B.some(b=>Math.abs(b-q)<0.009));
  return out.length?out:all;
}
function shSizes(C,P){
  const all=(C.R.PRICE_ENGINE.sizesBy&&C.R.PRICE_ENGINE.sizesBy[P])||C.R.PRICE_ENGINE.sizes;
  const B=(C.R.PRICE_ENGINE.boardBy||{})[P];
  return (Array.isArray(B)&&B.length)?all.filter(q=>B.some(b=>Math.abs(b-q)<0.009)):all;
}
function ladderFor(C,P){const o=C.R.LADDER_BY[P];return o?{...C.R.LADDER,...o}:C.R.LADDER;}

/* the lots */
function latestLot(C,p){
  const ls=pPurch(C.B,p).filter(x=>POSITION_ENGINE.poLive(x)&&x.qty>0&&POSITION_ENGINE.poRecvUnits(x)>0).sort(byDate);
  const L=ls[ls.length-1];
  return L?{qty:L.qty,total:L.total,rate:+(L.total/L.qty).toFixed(4),date:L.receivedOn||L.date,sup:L.supplier}:null;
}
function meanLotQty(C,p){
  const ls=pPurch(C.B,p).filter(x=>POSITION_ENGINE.poLive(x)&&x.qty>0);
  if(!ls.length)return null;
  return ls.reduce((a,x)=>a+x.qty,0)/ls.length;
}
function windowLots(C,p){
  return pPurch(C.B,p).filter(x=>POSITION_ENGINE.poLive(x)&&x.qty>0&&x.total>0&&(x.receivedOn||x.date)&&POSITION_ENGINE.poRecvUnits(x)>0).sort(byDate).slice(-3);
}
function priceLockState(C,p){
  const L=C.R.PRICE_LOCK[p], cur=latestLot(C,p);
  if(!L)return {state:'none',lock:null,cur:cur};
  if(!cur)return {state:'locked',lock:L,cur:null,days:dAge(C,L.lockedOn)};
  const same=(cur.date===L.lot.date&&Math.abs(cur.rate-L.lot.rate)<0.005&&Math.abs(cur.qty-L.lot.qty)<0.005);
  return {state:same?'locked':'stale',lock:L,cur:cur,days:dAge(C,L.lockedOn),sinceLot:dAge(C,L.lot.date)};
}
/* 20 Oct 2026: a reward unit (rewardOf) rides its order's drop, so it is not a delivery: it is out of the share and the mean size */
function delShare(C,p){
  const rows=pSales(C.B,p).filter(s=>!s.cancelled&&!s.rewardOf&&POSITION_ENGINE.txPhys(s)>0.009);
  const said=rows.filter(s=>s.handover==='delivered'||s.handover==='collected');
  const del=said.filter(s=>s.handover==='delivered');
  return said.length
    ? {v:del.length/said.length,delivered:del.length,said:said.length,of:rows.length,measured:true}
    : {v:C.R.COST_BASIS.deliveredShare.v,delivered:0,said:0,of:rows.length,measured:false};
}
function avgDelivery(C,p){
  const rows=pSales(C.B,p).filter(s=>!s.cancelled&&!s.rewardOf&&POSITION_ENGINE.txPhys(s)>0.009);
  const unitsSum=rows.reduce((a,s)=>a+POSITION_ENGINE.txPhys(s),0);
  return rows.length?{n:rows.length,kg:+unitsSum.toFixed(2),mean:+(unitsSum/rows.length).toFixed(4)}:{n:0,kg:0,mean:null};
}

/* the rates the cost stack reads */
function replRate(C,p){
  const ps=windowLots(C,p);
  const k=ps.reduce((a,x)=>a+x.qty,0);
  if(k>0)return +(ps.reduce((a,x)=>a+x.total,0)/k).toFixed(2);
  const L=latestLot(C,p);
  return L?+L.rate.toFixed(2):null;
}
function replCost(C,p){
  if(((C.B.costRule||{})[p]||{}).kind==='latestCogs'){const lc=POSITION_ENGINE.latestCogs(pPurch(C.B,p));if(lc)return +lc.rate.toFixed(2);}
  const r=replRate(C,p);
  if(r!=null)return +r.toFixed(2);
  const c=C.W.stockCost;return +((c!=null?c:C.W.wavgBuy)).toFixed(2);
}
function quoteRate(C,p){
  const q=C.B.quotes[p]||null;
  if(!q||!q.tiers||!q.tiers.length)return replCost(C,p);
  return Math.max.apply(null,q.tiers.map(t=>t.total/t.qty));
}
function freightRate(C,p){
  let ps=windowLots(C,p).filter(x=>x.freight!=null);
  if(!ps.length)ps=pPurch(C.B,p).filter(x=>POSITION_ENGINE.poLive(x)&&x.qty>0&&x.freight!=null);
  const k=ps.reduce((a,x)=>a+x.qty,0);
  return k>0?+(ps.reduce((a,x)=>a+(+x.freight||0),0)/k).toFixed(4):0;
}
function leakCharge(C,p){
  const cmp=(a,b)=>{const x=a.date,y=b.date;if(!x||!y)return (!x&&!y)?0:(!x?1:-1);return x<y?-1:x>y?1:0;};
  const cs=C.B.counts.filter(c=>(c.product||'salt')===p&&c.date&&c.drift!=null).sort(cmp);
  const last=cs.slice(-3); if(!last.length)return null;
  const all=C.B.counts.filter(c=>(c.product||'salt')===p&&c.date).sort(cmp);
  const i=all.findIndex(c=>c.date===last[0].date);
  const start=i>0?all[i-1].date:null, end=last[last.length-1].date;
  const leak=Math.max(0,-last.reduce((a,c)=>a+(+c.drift||0),0));
  const inWin=d=>!!d&&(start==null||d>start)&&d<=end;
  const sold=pSales(C.B,p).filter(s=>!s.cancelled).reduce((a,s)=>{
    let got=0,tr=0;
    (s.amend||[]).forEach(st=>{const k=+st.kg||0;if(st.kind!=='Fulfilment'||st.undone||!(k>0))return;tr+=k;if(inWin(st.date||s.date))got+=k;});
    const rest=(+s.deliveredQty||0)-tr;
    if(rest>0&&inWin(s.deliveredOn||s.date))got+=rest;
    return a+got;},0);
  if(!(sold>0))return null;
  return {ratio:+(leak/sold).toFixed(4),leak:+leak.toFixed(2),sold:+sold.toFixed(2),cycles:last.length,from:start,to:end};
}
function sampleUnits(C,p){return C.B.selfUseLog.filter(r=>(r.product||C.B.defaultProd)===p&&r.why==='sample').reduce((a,r)=>a+(+r.kg||0),0);}
function shrinkRate(C,p){const h=C.W.buyUnits+openingFor(C.B,p).qty;
  return h>0?Math.max(0,C.W.selfUse-sampleUnits(C,p))/h:0;}

/* 10 NOV 2026, HIS DECISION: THE NON-REVENUE SHARE A BOOK'S FLOOR CARRIES (RULES.nrsFloor names the book and which of his three
   categories count). Units that left and earned nothing: the count shortfall (the walk's selfUse, the promotion's sample inside it),
   gifts and rewards with reward cover, and written off. Over the units handed over and paid for; a unit settled in kind is paid for
   (his word). Null where nothing reads: no rule, nothing lost, or nothing paid for.
   11 NOV 2026, HIS ANSWER H: IT IS RE-MEASURED ONLY WHEN HE STATES THE SHELF OR THE COST, never by trading, so the Floor and a salt
   discount, which is a place between the Median and that Floor, stand still between those days. The anchor (`nrsAnchor`) is the
   latest day, today at the latest, of a count, a recorded loss or a landed lot, read off the book; a count still queued on the
   page (the overlay's statedStockBy, which moves the page's shortfall) is a count of today, so the page previews what the fold
   will make. Each row is read as it stood when that day began (`heldBefore`): what it handed over on or after the day is left
   out, what it took back or had undone on or after it is still in, and a write-off dated on or after it (writeOffDay) is still a
   sale. The shortfall is the walk's as it stands: the roll holds it still between counts, and a recorded loss, which moves it, is
   an anchor itself. Still live, said: a loan in kind (the walk's soldUnits carries it undated), reward cover put on an older
   row, a row, a count or a loss dated before the anchor and entered or corrected after it, a lot's units restated under what
   landed, and a loan settled with units left. A book with no count, loss or lot reads live, as it did.
   A WRITE-OFF WITH NO STAMP is dated here by the step that set the flag (writeOffDay asked `exact`, Fable's two reviews of H), not
   by the newest Correction the loyalty walk reads: no road stamps a sale's defaultedOn, and by the newest a later note on a
   written-off row would take the write-off out of the share until the next measure and bring it back, a Floor that bounces.
   Also said: a trail stating more units than the row holds, with a step on or after the day, under-reads that row (one such row
   on the book, cancelled and holding none), and a queued count typed for an earlier day previews as today's. */
function nrsAnchor(C,p){
  const dp=C.B.defaultProd||'salt', now=C.today?todayISO(C):null;
  const mine=r=>r&&(r.product||dp)===p&&r.date&&(!now||String(r.date)<=now);
  const last=rows=>(rows||[]).filter(mine).map(r=>String(r.date)).sort().pop()||null;
  const lc=C.B.purchases?POSITION_ENGINE.latestCogs(pPurch(C.B,p),now):null;
  const queued=now&&C.B.statedStockBy&&C.B.statedStockBy[p]!=null?now:null;
  return [['count',queued||last(C.B.counts)],['loss',last(C.B.selfUseLog)],['lot',lc&&lc.date?String(lc.date):null]]
    .reduce((a,x)=>x[1]&&(!a||x[1]>a.at)?{at:x[1],by:x[0]}:a,null);
}
/* the units a row had handed over when day `at` began: what it holds now, less every standing move dated on or after that day (a
   Correction that took units back among them, which adds them again), plus a move made before it and undone on or after it. With
   nothing on or after the day it is txPhys to the unit, whatever the trail says. */
function heldBefore(s,at){
  const phys=POSITION_ENGINE.txPhys(s);if(!at)return phys;
  const moves=(s.amend||[]).filter(a=>a&&a.date&&((a.kind==='Fulfilment'&&+a.kg>0.0001)||(a.kind==='Correction'&&Math.abs(+a.kg||0)>0.0001)));
  const stand=moves.filter(a=>!a.undone), rest=phys-stand.reduce((t,a)=>t+ +a.kg,0);
  const since=stand.reduce((t,a)=>t+(String(a.date)>=at?+a.kg:0),0)+(rest>0.0001&&String(s.deliveredOn||s.date||'')>=at?rest:0);
  const undone=moves.reduce((t,a)=>t+(typeof a.undone==='string'&&a.undone>=at&&String(a.date)<at?+a.kg:0),0);
  return Math.max(0,phys-since+undone);
}
function nrsShare(C,p){
  const K=((C.R.RULES||{}).nrsFloor||{})[p];if(!K)return null;
  const A=nrsAnchor(C,p), at=A?A.at:null, lock=(C.R.RULES||{}).lockDays;
  let gifts=0,off=0,later=0;
  pSales(C.B,p).forEach(s=>{
    const q=heldBefore(s,at);
    later+=POSITION_ENGINE.txPhys(s)-q;           /* off the walk's soldUnits, which counts a cancelled row's units too */
    if(s.cancelled)return;
    if(s.goodwill){gifts+=q;return;}
    if(s.defaulted&&!(at&&POSITION_ENGINE.writeOffDay(s,lock,true)>=at)){off+=q;return;}
    gifts+=Math.min(q,Math.max(0,+s.coverUnits||0));
  });
  const short=Math.max(0,+C.W.selfUse||0), paid=(+C.W.soldUnits||0)-later-gifts-off;
  const lost=(K.shortfall?short:0)+(K.gifts?gifts:0)+(K.writtenOff?off:0);
  if(!(paid>0)||!(lost>0))return null;
  return Object.assign({share:+(lost/paid).toFixed(6),shortfall:+short.toFixed(2),gifts:+gifts.toFixed(2),writtenOff:+off.toFixed(2),paid:+paid.toFixed(2)},A||{});
}
/* the records the pricing engine takes */
function inputs(C,p){
  const R=C.R,o=C.over||{cost:null,shrink:null};
  const nr=nrsShare(C,p);
  return Object.assign(nr?{nrs:nr}:{},{prod:p, lockOn:R.PRICE_LOCK_ON, lockState:priceLockState(C,p), lockBase:R.PRICE_LOCK[p]||null,
    over:{cost:o.cost,shrink:o.shrink}, lot:latestLot(C,p), meanLot:meanLotQty(C,p), quoteRate:quoteRate(C,p),
    repl:replRate(C,p), freightRate:freightRate(C,p), leak:leakCharge(C,p),
    costRule:(C.B.costRule||{})[p]||null,
    latest:(x=>x&&{rid:x.rid,date:x.date,quote:x.quote,freight:x.freight,units:x.units,rate:x.rate})(POSITION_ENGINE.latestCogs(pPurch(C.B,p))),
    costBasis:{freightPerTrip:{rm:R.COST_BASIS.freightPerTrip.rm},txnPerDelivery:{rm:R.COST_BASIS.txnPerDelivery.rm},
      deliveredShare:{v:delShare(C,p).v}},
    attrib:R.SHRINK_ATTRIB, shrinkRate:shrinkRate(C,p), avgDel:avgDelivery(C,p)});
}
/* 11 Nov 2026: the policy carries the day's market move on a band book (marketOf) and his re-anchored points (ruleFor). `plain` leaves the move
   out: the evidence (a past sale's place, the 90-day reading) is read against the plain Median, never the day's move. */
function policy(C,p,plain){
  const R=C.R,pq=C.B.quotes[p]||null,mk=plain?null:marketK(C,p);
  return Object.assign({LADDER:ladderFor(C,p), minPerUnit:R.PRICE_ENGINE.minPerUnit||0, timePerOrder:R.PRICE_ENGINE.timePerOrder||0, floorTo:(R.RULES&&R.RULES.floorTo)||0, lotFloor:R.PRICE.lotFloor||{},
    stated:setPricesFor(C,p),
    tierRule:ruleFor(C,p),
    tiers:(pq&&pq.tiers)?pq.tiers:[],
    boardSizes:sizesFor(C,p)},mk?{market:mk}:{});
}

/* ============ 11 NOV 2026, THE PRICE BAND'S VERSION 2: THE MARKET (docs/plan-salt-price-band.html Steps 3 and 4, "Dependable") ============
   Pure arithmetic on the book, no model and no state: the move on a day is a walk from the rule's `since`, a day at a time, so the Desk, the
   drafter's snapshot, the price lists and the replay of the past read one figure for one day. Each day is read off the book AS IT STOOD WHEN
   THE DAY BEGAN (rows dated before it), so trading through the day moves no price until the next. His switch and his points are the book's
   MARKET document ({[book]: {switch: [{on, from}], anchors: [{q, x, from, price}]}}), written only by entries he approves; an absent document
   is on, with no points of his. Said, not modelled: a loan in kind, a lot part received over several days (all on its receivedOn), a row
   dated earlier and entered later (the walk reads it as of its date, so a past day can read anew). */
const isoOf=d=>d.toISOString().slice(0,10);
const dayAt=s=>new Date(String(s)+'T00:00:00Z');
const addDays=(s,n)=>isoOf(new Date(dayAt(s).getTime()+n*864e5));
const clampN=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
function marketDoc(C,p){const M=(C.B.market||{})[p];return M&&typeof M==='object'?M:{};}
function marketRule(C,p){const R=C.R.TIER_RULE[p];return R&&R.band&&R.market&&R.market.since?R.market:null;}
/* his re-anchored points over the rule's own, each from its day, the newest at a size winning; a band book alone */
function ruleFor(C,p){
  const R=C.R.TIER_RULE[p];if(!R||!R.band)return R||null;
  const day=C.today?todayISO(C):null;
  const A=(marketDoc(C,p).anchors||[]).filter(a=>a&&+a.q>0&&+a.x>0&&isFinite(+a.x)&&(!day||!a.from||String(a.from)<=day));
  return A.length?PRICING_ENGINE.withPoints(R,A.map(a=>[a.q,a.x])):R;
}
function switchOn(C,p,t){let on=true;(marketDoc(C,p).switch||[]).forEach(s=>{if(s&&s.from&&String(s.from)<=t)on=s.on!==false;});return on;}
/* the units a row handed over on the days `inWin` passes, its trail read as heldBefore reads it */
function movedIn(s,inWin){
  const moves=(s.amend||[]).filter(a=>a&&a.date&&!a.undone&&((a.kind==='Fulfilment'&&+a.kg>0.0001)||(a.kind==='Correction'&&Math.abs(+a.kg||0)>0.0001)));
  const rest=POSITION_ENGINE.txPhys(s)-moves.reduce((t,a)=>t+ +a.kg,0);
  return moves.reduce((t,a)=>t+(inWin(a.date)?+a.kg:0),0)+(rest>0.0001&&inWin(s.deliveredOn||s.date)?rest:0);
}
/* THE SHELF AT THE START OF DAY t (his answer: one plain cover): the last count dated before it (its qty), else the opening; plus the units of
   each live lot received since, less every handover and recorded loss since. An estimate: a count is taken as the day's end. */
function shelfAt(C,p,t){
  const dp=C.B.defaultProd||'salt';
  const cs=(C.B.counts||[]).filter(c=>c&&(c.product||dp)===p&&c.date&&String(c.date)<t&&c.qty!=null&&isFinite(+c.qty)).sort((a,b)=>String(a.date)<String(b.date)?-1:String(a.date)>String(b.date)?1:0);
  const last=cs[cs.length-1], from=last?String(last.date):null;
  const inWin=d=>!!d&&String(d)<t&&(from==null||String(d)>from);
  let shelf=last?+last.qty:+(openingFor(C.B,p).qty||0);
  pPurch(C.B,p).forEach(x=>{if(!POSITION_ENGINE.poLive(x))return;const u=POSITION_ENGINE.poRecvUnits(x);if(u>0&&inWin(x.receivedOn||x.date))shelf+=u;});
  pSales(C.B,p).forEach(s=>{shelf-=movedIn(s,inWin);});
  (C.B.selfUseLog||[]).forEach(r=>{if(r&&(r.product||dp)===p&&inWin(r.date))shelf-=(+r.kg||0);});
  return shelf;
}
function demandBefore(C,p,t){return pSales(C.B,p).filter(s=>pbPriced(s)&&!s.rewardOf&&!s.goodwill&&s.date&&String(s.date)<t&&+s.qty>0).map(s=>({date:String(s.date),qty:+s.qty}));}
/* the cover on day t: the engine's restockPlan over the demand before it and the shelf at its start, no rhythm, dues or holidays. days is
   Infinity past the forecast; none, no demand measured */
function marketCover(C,p,t){
  const rows=demandBefore(C,p,t), free=+Math.max(0,shelfAt(C,p,t)).toFixed(2);
  const plan=POSITION_ENGINE.restockPlan({rows:rows,today:dayAt(t),free:free,leadDays:1});
  if(plan.empty)return {free:free,days:null,none:true};
  return {free:free,days:plan.coverDays==null?Infinity:+plan.coverDays};
}
function supplyPts(cv,M){
  if(!cv||cv.none||cv.days==null)return 0;
  for(const s of (M.supply||[]))if(cv.days<=+s[0]+1e-9)return +s[1];
  return +M.long||0;
}
function marketPace(C,p,t,M){
  const P=M.pace||{},rows=demandBefore(C,p,t),u=n=>rows.filter(r=>r.date>=addDays(t,-n)).reduce((a,r)=>a+r.qty,0);
  const l=u(+P.long||56)/(+P.long||56), s=u(+P.short||14)/(+P.short||14);
  if(!(l>0))return {ratio:null,pts:0};
  const ratio=+(s/l).toFixed(4);
  return {ratio:ratio,pts:ratio>=(+P.fast||1.25)-1e-9?(+P.k||0):ratio<=(+P.slow||0.75)+1e-9?-(+P.k||0):0};
}
/* margin a day over [a, b): the goods less the row's own cost, priced sales with a cost; a row with none is left out */
function marginDay(C,p,a,b){
  const rows=pSales(C.B,p).filter(s=>pbPriced(s)&&!s.goodwill&&!s.rewardOf&&s.date&&String(s.date)>=a&&String(s.date)<b&&typeof s.cost==='number'&&isFinite(s.cost));
  const days=Math.max(1,Math.round((dayAt(b)-dayAt(a))/864e5));
  return rows.reduce((t,s)=>t+POSITION_ENGINE.txGoods(s)-s.cost,0)/days;
}
/* margin a day fell `n` weeks running, the newest full week (the seven days before t) under the one before, and so on */
function fellRunning(C,p,t,n){
  const w=[];for(let i=0;i<=n;i++)w.push(marginDay(C,p,addDays(t,-7*(i+1)),addDays(t,-7*i)));
  for(let i=0;i<n;i++)if(!(w[i]<w[i+1]-0.005))return false;
  return true;
}
/* THE WALK OF THE MOVE from `from` (the rule's since) to `day`, inclusive: each day's target is the supply's points (and the pace's, only once it
   acts), held between min and max, capped at nought while stood down; the move goes at most `step` towards it. Switched off, the move is nought
   that day, and on again it climbs from nought. Answers the last day's entry with the whole log, or null for a book with no market rule. */
function marketWalk(C,p,day,from){
  const M=marketRule(C,p);if(!M)return null;
  const start=from||M.since;
  if(!day||String(day)<String(start))return {day:day,k:0,on:false,before:true,since:start,log:[]};
  const step=+M.step||0.05,lo=+M.min,hi=+M.max,st=M.stand||{},log=[];
  let k=0,downTo=null;
  for(let t=String(start);t<=String(day);t=addDays(t,1)){
    if(!switchOn(C,p,t)){k=0;downTo=null;log.push({day:t,k:0,on:false});continue;}
    const cv=marketCover(C,p,t),sp=supplyPts(cv,M),pc=marketPace(C,p,t,M),acts=!!(M.pace&&M.pace.acts);
    let target=clampN(sp+(acts?pc.pts:0),lo,hi),stood=false;
    if(downTo&&t<=downTo)stood=true;
    else{downTo=null;if(k>1e-9&&+st.weeks>0&&fellRunning(C,p,t,+st.weeks)){downTo=addDays(t,(+st.hold||7)-1);stood=true;}}
    if(stood)target=Math.min(target,0);
    k=+(k+clampN(target-k,-step,step)).toFixed(4);
    log.push({day:t,k:k,on:true,target:+target.toFixed(4),cover:cv.days===Infinity?null:cv.days,long:cv.days===Infinity,none:!!cv.none,free:cv.free,
      supply:sp,pace:pc.ratio,pacePts:pc.pts,paceActs:acts,stood:stood});
  }
  return Object.assign({},log[log.length-1],{since:start,log:log});
}
/* the day's move for a book, null off a band book or before the rule's since; marketK the number the walk reads */
function marketOf(C,p){if(!marketRule(C,p)||!C.today)return null;const d=todayISO(C);return viaMemo(C,'market|'+p+'|'+d,()=>marketWalk(C,p,d));}
function marketK(C,p){const m=marketOf(C,p);return m&&m.on&&Math.abs(m.k)>1e-9?m.k:null;}
/* THE REASON, in his words, the one place they are made (the Desk's Pricing and Salt Admin both show it): "Median +5: 4.2 days of cover" */
function marketWhy(e){
  if(!e)return '';
  const pts=v=>(v>0?'+':v<0?'-':'')+Math.round(Math.abs(v)*100);
  if(e.before)return 'The market move starts on '+e.since+'.';
  if(e.on===false)return 'Switched off: every price is on the plain Median.';
  const cov=e.none?'no demand measured':e.long?'over 14 days of cover':(+e.cover).toFixed(1)+' days of cover';
  let w='Median '+(Math.abs(e.k)<1e-9?'0':pts(e.k))+': '+cov;
  if(e.stood)w+=', held at nought or under: margin a day fell two weeks running while the move was up';
  else if(Math.abs(e.target-e.k)>1e-9)w+=', moving 5 a day towards '+pts(e.target);
  if(e.pace!=null&&e.pacePts&&!e.paceActs)w+='; pace '+Math.round(Math.abs(e.pace-1)*100)+'% '+(e.pace>1?'above':'below')+' normal, said and not priced';
  return w+'.';
}
/* THE REPLAY OF THE PAST ("proved on the past before it runs"): the walk from the book's first priced day to today, each day's move and what it
   would have quoted at q on TODAY's posts (today's cost and Median: the move is what is replayed), beside the median goods paid that day at q */
function marketReplay(C,p,q){
  const M=marketRule(C,p);if(!M||!C.today)return null;
  const rows=pSales(C.B,p).filter(s=>pbPriced(s)&&!s.goodwill&&!s.rewardOf&&s.date&&+s.qty>0);
  const first=rows.map(s=>String(s.date)).sort()[0];if(!first)return null;
  const w=marketWalk(C,p,todayISO(C),first);if(!w)return null;
  const K=cost(C,p),P0=policy(C,p,true),med=a=>{const s=a.slice().sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length?(s.length%2?s[m]:(s[m-1]+s[m])/2):null;};
  const at=k=>{const x=PRICING_ENGINE.driftAt(q,K,Object.assign({},P0,k?{market:k}:{}),0);return x?x.p:null;};
  const memo={};
  return w.log.map(e=>{const key=e.k.toFixed(4);if(!(key in memo))memo[key]=at(e.k);
    const paid=rows.filter(s=>String(s.date)===e.day&&Math.abs(+s.qty-q)<0.009&&!s.oneOff).map(s=>POSITION_ENGINE.txGoods(s));
    return {day:e.day,k:e.k,on:e.on,quote:memo[key],paid:med(paid),n:paid.length};});
}
/* THE 90-DAY READING (Step 4): at each size with sales in the window, the usual goods paid, the profit-best price and the plain Median, with the
   count behind each. The profit-best is the price among those paid that earns the most per buyer seen, (price less exact cost) times the share
   who would take it: those who paid it or more, and those who cancelled at a higher price (a cancelled order is a buyer who declined at its
   price, the plan's losses, and would have taken a lower one); a one-off, a gift or a reward is left out. Only prices that sold are in the book, so it is a floor on the true answer. A re-anchor is SUGGESTED, never made, where the
   profit-best and the Median differ by RM 5 or more at a size with 10 or more sales; his tap makes it. `smaller` counts, as said and not
   priced, the sales over 8% above the usual whose buyer's next order was smaller. */
function priceReading(C,p,days){
  const R=C.R.TIER_RULE[p];if(!R||!R.band||!C.today)return null;
  const to=todayISO(C),from=addDays(to,-(days||90)),K=cost(C,p),P0=policy(C,p,true);
  const all=pSales(C.B,p).filter(s=>s.date&&String(s.date)>=from&&String(s.date)<to&&!s.goodwill&&!s.rewardOf&&!s.oneOff&&+s.qty>0&&POSITION_ENGINE.txGoods(s)>0);
  const cancelled=s=>POSITION_ENGINE.txStat(s).order==='Cancelled';
  const sizes=[...new Set(all.map(s=>+(+s.qty).toFixed(4)))].sort((a,b)=>a-b);
  const med=a=>{const s=a.slice().sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length?(s.length%2?s[m]:(s[m-1]+s[m])/2):null;};
  const allP=pSales(C.B,p).filter(s=>s.date&&+s.qty>0&&!s.goodwill&&!s.rewardOf).sort((a,b)=>String(a.date)<String(b.date)?-1:1);
  return sizes.map(q=>{
    const rows=all.filter(s=>Math.abs(+s.qty-q)<0.009),sold=rows.filter(s=>!cancelled(s)&&pbPriced(s)),dec=rows.filter(cancelled);
    const prices=sold.map(s=>POSITION_ENGINE.txGoods(s)),usual=med(prices),c=PRICING_ENGINE.costTotal(q,K,P0),seen=sold.length+dec.length;
    let best=null,bestM=-Infinity;
    [...new Set(prices)].sort((a,b)=>a-b).forEach(x=>{const m=(x-c)*(prices.filter(v=>v>=x-0.009).length+dec.filter(s=>POSITION_ENGINE.txGoods(s)>x+0.009).length)/seen;if(m>bestM+1e-9){bestM=m;best=x;}});
    const mq=PRICING_ENGINE.quoteAt(q,K,P0,0);
    const smaller=usual==null?0:sold.filter(s=>{if(!(POSITION_ENGINE.txGoods(s)>usual*1.08))return false;
      const nx=allP.find(x=>POSITION_ENGINE.ownsCode(ownerOf(s.customer)||s.customer,x.customer)&&String(x.date)>String(s.date));return !!nx&&+nx.qty<+s.qty-0.009;}).length;
    const suggest=best!=null&&mq!=null&&sold.length>=10&&Math.abs(best-mq)>=5-1e-9;
    return {q:q,sales:sold.length,declined:dec.length,usual:usual,best:best,median:mq,cost:+(+c).toFixed(2),smaller:smaller,suggest:suggest};
  });
}
/* THE WEEKLY SCORECARD (Dependable): the seven days before today against the eight weeks before them. Margin a day, orders, new buyers (a first
   salt order), regulars won back (four orders or more before, this one after more than one and a half times their own usual gap), and what
   the move added or cost: each sale of the week priced again at its customer's held place with the day's move and with none (an estimate,
   since an order is priced when agreed and their place can have changed since). */
function marketScore(C,p){
  const M=marketRule(C,p);if(!M||!C.today)return null;
  const to=todayISO(C),a=addDays(to,-7),rows=pSales(C.B,p).filter(s=>pbPriced(s)&&!s.goodwill&&!s.rewardOf&&s.date&&+s.qty>0);
  const inW=(s,x,y)=>String(s.date)>=x&&String(s.date)<y;
  const prior=[];for(let i=1;i<=8;i++)prior.push(marginDay(C,p,addDays(a,-7*i),addDays(a,-7*(i-1))));
  const week=rows.filter(s=>inW(s,a,to)),firstOf={};
  rows.slice().sort((x,y)=>String(x.date)<String(y.date)?-1:1).forEach(s=>{const o=ownerOf(s.customer)||s.customer;if(!(o in firstOf))firstOf[o]=String(s.date);});
  const newB=[...new Set(week.map(s=>ownerOf(s.customer)||s.customer))].filter(o=>firstOf[o]>=a).length;
  let back=0;
  [...new Set(week.map(s=>ownerOf(s.customer)||s.customer))].forEach(o=>{
    const ds=[...new Set(rows.filter(s=>POSITION_ENGINE.ownsCode(o,s.customer)).map(s=>String(s.date)))].sort(),i=ds.findIndex(d=>d>=a);
    if(i<4)return;const gaps=[];for(let j=1;j<i;j++)gaps.push((dayAt(ds[j])-dayAt(ds[j-1]))/864e5);
    const g=gaps.slice().sort((x,y)=>x-y)[Math.floor(gaps.length/2)];if(g>0&&(dayAt(ds[i])-dayAt(ds[i-1]))/864e5>1.5*g)back++;});
  const w=marketWalk(C,p,addDays(to,-1)),byDay={};((w&&w.log)||[]).forEach(e=>{byDay[e.day]=e.k;});
  const K=cost(C,p),P0=policy(C,p,true);let added=0;
  week.forEach(s=>{const k=byDay[String(s.date)]||0;if(!k||isPartner(C,s.customer))return;const d=driftS(C,p,s.customer),pc=d?d.d:0;
    const x=PRICING_ENGINE.quoteAt(+s.qty,K,Object.assign({},P0,{market:k}),pc),y=PRICING_ENGINE.quoteAt(+s.qty,K,P0,pc);if(x!=null&&y!=null)added+=x-y;});
  const mean=prior.reduce((t,v)=>t+v,0)/prior.length;
  return {from:a,to:to,margin:+marginDay(C,p,a,to).toFixed(2),prior:+mean.toFixed(2),orders:week.length,newBuyers:newB,wonBack:back,added:+added.toFixed(2)};
}
/* the board for a book, on its own rungs (its stated prices, or its floor, Set Price and Ceiling); null for a book with no rule. `cost` is a function, read only when there is a rule */
function fiveTiers(C,p,cost){
  const R=C.R.TIER_RULE[p];
  const sizes=R?R.rungs.concat(sizesFor(C,p).filter(q=>!R.rungs.some(r=>Math.abs(r-q)<0.009))).sort((a,b)=>a-b):null;
  return R?PRICING_ENGINE.fiveTiers(sizes,cost(),policy(C,p)):null;
}

/* S1c-iii: THE CARDS AND THE DRIFT. Whose account a code is, who is a person, who pays cost, and what each customer is quoted.
   Added to C: B.roster, B.partners, B.tierOf (the held % lifts, TIER_OF), B.prodOrder; R.RULES and R.PROFILE_RULE; and two hooks the desk
   fills and a Worker may leave out: C.memo(key,f), the render's cache (none: made fresh). */
const viaMemo=(C,k,f)=>C.memo?C.memo(k,f):f();
const isResellAcct=id=>typeof id==='string'&&id.slice(-2)==='-R';
const ownerOf=id=>isResellAcct(id)?id.slice(0,-2):id;      /* the desk's isBucket has been always false since v265 */
const isPerson=id=>!!id;
/* the desk's tests (and nothing else) swap lateOf, buyerProfile, driftOfNow and driftOf at run time: the desk hands each in as C.fn.NAME(args without C), so a swap still takes; a Worker leaves C.fn out */
const lateOfS=(C,code)=>C.fn&&C.fn.lateOf?C.fn.lateOf(code):lateOf(C,code);
const profileS=(C,p,code)=>C.fn&&C.fn.buyerProfile?C.fn.buyerProfile(p,code):buyerProfile(C,p,code);
const driftNowS=(C,p,code)=>C.fn&&C.fn.driftOfNow?C.fn.driftOfNow(p,code):driftOfNow(C,p,code);
const driftS=(C,p,code)=>C.fn&&C.fn.driftOf?C.fn.driftOf(p,code):driftOf(C,p,code);
const todayISO=C=>C.today.toISOString().slice(0,10);
function pbPriced(s){const st=POSITION_ENGINE.txStat(s).order;
  if(st==='Pending'||st==='Cancelled'||st==='Default')return false;
  if((s.rebate||s.goodwill)&&!((+s.cash||0)>0.009))return false;
  return true;}
function isPartner(C,code){return C.B.partners.includes(ownerOf(code)||code);}
function lateOf(C,code){return POSITION_ENGINE.lateOffer(POSITION_ENGINE.payDelays(C.B.sales,ownerOf(code)||code,todayISO(C),C.R.RULES),C.R.RULES);}
function buyerProfile(C,prod,code){
  const R=C.R.PROFILE_RULE, DAY=86400000, now=C.today.getTime();
  const rows=pSales(C.B,prod).filter(s=>POSITION_ENGINE.ownsCode(code,s.customer)&&pbPriced(s)&&s.date&&s.total>0&&s.qty>0);
  if(!rows.length)return null;
  const times=rows.map(s=>new Date(s.date).getTime()).sort((a,b)=>a-b);
  const tenure=(now-times[0])/DAY, sinceLast=(now-times[times.length-1])/DAY;
  const perMonth=rows.length/(Math.max(tenure,R.spanFloorDays)/30.44);
  const unitsPerMonth=rows.reduce((a,s)=>a+s.qty,0)/(Math.max(tenure,R.spanFloorDays)/30.44);   /* 05 Oct 2026: the drift's volume signal */
  const smallShare=rows.filter(s=>s.qty<=R.smallUpTo+0.0001).length/rows.length;
  const bigShare=rows.filter(s=>s.qty>=R.bigFrom-0.0001).length/rows.length;
  const frequent=perMonth>=R.frequentPerMonth, small=smallShare>=R.smallShare, bigger=bigShare>=R.biggerShare;
  const loyal=rows.length>=R.loyalOrders&&sinceLast<=R.loyalWithinDays;
  const rare=perMonth<R.rarePerMonth||sinceLast>R.rareAfterDays;
  const name=rows.length===1?'one-off'
    :small?(frequent?'small and often':'small and rare')
    :bigger?(frequent?'large and regular':'rare and large')
    :frequent?'consistent mid':'occasional mid';
  return {name,orders:rows.length,tenureDays:Math.round(tenure),sinceLastDays:Math.round(sinceLast),
    perMonth:+perMonth.toFixed(2),unitsPerMonth:+unitsPerMonth.toFixed(2),smallShare:+smallShare.toFixed(2),bigShare:+bigShare.toFixed(2),
    frequent,small,bigger,loyal,rare};
}
function driftBook(C,p){const R=C.R.TIER_RULE[p];return !!(R&&R.drift);}
/* 22 Oct 2026: a book that takes Their %, a Set Price or a stated board carrying `pct` (the engine's pctBook) */
function pctBook(C,p){return PRICING_ENGINE.pctBook(C.R.TIER_RULE[p]);}
function driftSignals(C,prod,code){
  const who=ownerOf(code)||code,pf=profileS(C,prod,who),RU=C.R.RULES;
  const dl=POSITION_ENGINE.payDelays(C.B.sales,who,todayISO(C),RU),settled=dl.filter(x=>!x.open),open=dl.filter(x=>x.open);
  const lt=lateOfS(C,who);
  const wo=C.B.sales.filter(s=>POSITION_ENGINE.ownsCode(who,s.customer)).reduce((a,s)=>a+POSITION_ENGINE.txWrittenOff(s),0);
  return {settled:settled.length,onTime:settled.filter(x=>x.days<=RU.holdDays).length,
    perMonth:pf?pf.perMonth:0,unitsPerMonth:pf?pf.unitsPerMonth:0,orders:pf?pf.orders:0,sinceLastDays:pf?pf.sinceLastDays:null,
    late:!!lt.on,lateLong:!!(lt.on&&lt.why==='long'),writtenOff:+wo.toFixed(2),
    overdueDays:open.reduce((m,x)=>Math.max(m,x.days-RU.holdDays),0)};
}
/* 18 OCT 2026, HIS DECISION: THE FIGURE THAT PRICES IS THE % LIFT HE HOLDS, OR NOUGHT. `d` is that figure (-0.3 to +0.3 since 21 Oct 2026) and nothing automatic reaches it:
   `auto`, `G` and `B` are the record's reading (autoDrift) kept for the card, and the suggestion is suggestOf below. */
function driftOfNow(C,p,code){
  const R=C.R.TIER_RULE[p];if(!PRICING_ENGINE.pctBook(R))return null;
  /* 10 Nov 2026: the held figure is judged on this book's own range (11 Nov 2026: read as it stands, the switch's carry-over booked and gone) */
  const who=ownerOf(code)||code,h=(C.B.tierOf[who]||{})[p],hand=PRICING_ENGINE.driftOk(h,R)?+h:null;
  const sig=driftSignals(C,p,who),a=PRICING_ENGINE.autoDrift(sig,R.auto);
  return Object.assign({},a,{auto:a.d,hand:hand,d:hand!=null?hand:0,sig:sig});
}
function driftOf(C,p,code){return viaMemo(C,'drift|'+(ownerOf(code)||code)+'|'+p,()=>driftNowS(C,p,code));}
/* THE SUGGESTED % LIFT (his decision of 18 Oct 2026): the engine's suggestPct over the record's signals and the rate each of the customer's
   last S.recent salt sales paid over the Set Price rate at that sale's size (today's Set Price, the cost being today's). Prices nothing. */
function suggestOf(C,p,code){
  const R=C.R.TIER_RULE[p];if(!R||!R.drift)return null;
  return viaMemo(C,'suggest|'+(ownerOf(code)||code)+'|'+p,()=>{
    const who=ownerOf(code)||code,S=R.suggest||{},K=cost(C,p),P=policy(C,p,true);   /* 11 Nov 2026: the plain Median, his points in, the day's move out */
    /* 10 Nov 2026 (his ask D): a sale he let stand outside the band as a one-off (row.oneOff) is left out of the evidence */
    const rows=pSales(C.B,p).filter(x=>POSITION_ENGINE.ownsCode(who,x.customer)&&pbPriced(x)&&!x.oneOff&&x.date&&x.total>0&&x.qty>0)
      .sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0).slice(-(+S.recent||5));
    const ratios=rows.map(x=>{const set=PRICING_ENGINE.quoteAt(x.qty,K,P,0);return set>0?(POSITION_ENGINE.txGoods(x)/x.qty)/(set/x.qty):null;}).filter(v=>v!=null);
    /* 10 Nov 2026: on a band each of those sales is also placed on it at its own size (the engine's bandPct between today's Floor, Median and Ceiling) */
    const places=R.band?rows.map(x=>{const w=PRICING_ENGINE.driftAt(x.qty,K,P,0);return w&&w.set>0?PRICING_ENGINE.bandPct(POSITION_ENGINE.txGoods(x),w.floor,w.set,w.ceiling):null;}).filter(v=>v!=null):null;
    return PRICING_ENGINE.suggestPct(driftSignals(C,p,who),ratios,S,R.auto,Object.assign({},PRICING_ENGINE.liftRange(R),places?{places:places}:{}));
  });
}
function tierCustomers(C){
  const rev={};
  /* 20 Oct 2026: a reward unit (rewardOf) is not revenue, so it moves no customer up the list the cards are drawn in */
  C.B.sales.forEach(s=>{const o=ownerOf(s.customer);if(!o||!isPerson(o)||s.rewardOf||!(s.total>0)||POSITION_ENGINE.txStat(s).order==='Cancelled')return;rev[o]=(rev[o]||0)+s.total;});
  const rest=C.B.roster.map(ownerOf).filter((id,i,a)=>a.indexOf(id)===i&&isPerson(id)&&!id.startsWith('S')&&!(id in rev));
  return Object.keys(rev).sort((a,b)=>rev[b]-rev[a]).concat(rest);
}
function cost(C,p){const o=C.over||{cost:null,shrink:null};return viaMemo(C,'pxCost|'+p+'|'+o.cost+'|'+o.shrink,()=>PRICING_ENGINE.costStack(inputs(C,p)));}
/* a named customer's price at any size: a partner the Floor (RM 5 up); a stated board the board; a drift book the Set Price moved by their drift */
function cardQuote(C,p,code,q){
  if(!(q>0))return null;
  const o=C.over||{cost:null,shrink:null},K=cost(C,p),P=policy(C,p);   /* 11 Nov 2026: the policy's rule is his points over the rule's, and it carries the day's move */
  if(isPartner(C,code))return PRICING_ENGINE.quoteAt(q,K,P,'partner');   // 06 Oct 2026, his decision: a partner pays cost; 18 Oct 2026, the Floor, rounded up to the next RM 5
  const row=viaMemo(C,'tierAt|'+p+'|'+q+'|'+o.cost+'|'+o.shrink,()=>PRICING_ENGINE.fiveTierAt(q,K,P));
  if(row&&row.fixed){const dr=pctBook(C,p)?driftS(C,p,code):null;return PRICING_ENGINE.quoteAt(q,K,P,dr?dr.d:0);}
  if(row&&row.drift){const dr=driftS(C,p,code);return PRICING_ENGINE.quoteAt(q,K,P,dr?dr.d:0);}
  return null;}

/* a book's moved figures, the Worker's road: the walk is made here, and nothing else is read */
function ctxFor(B,R,prod,today,over){
  const C0={B,R,today,over,memo:B.memo,W:{buyUnits:0,selfUse:0,wavgBuy:0,stockCost:null}};   /* S5b: B.memo, when a caller gives one (engine/book-inputs.mjs), is the render's cache of the page */
  return {...C0,W:POSITION_ENGINE.walk(posInputs(C0,prod))};
}
function figuresOf(C,prod){
  const W=C.W,cost=PRICING_ENGINE.costStack(inputs(C,prod)),P=policy(C,prod),sizes=sizesFor(C,prod),floors={};
  sizes.forEach(q=>{floors[q]={floor:PRICING_ENGINE.floorTotal(q,cost,P)};});
  return {stockCost:W.stockCost, replCost:replCost(C,prod), inputs:{cost:inputs(C,prod),policy:P}, sizes, floors,
    rungs:shSizes(C,prod), ladder:fiveTiers(C,prod,()=>cost)};
}
function figures(B,R,prod,today,over=null){return figuresOf(ctxFor(B,R,prod,today,over),prod);}

/* the snapshot's pricing part for every book, as tools/book.mjs pricingSnapshot() reads it off the page: figures to four places,
   the ladder as the price list carries it, every customer's card at the shown sizes, and on a drift book each one's drift */
function pricing(B,R,today,over=null){
  const r4=v=>(typeof v==='number'&&Number.isFinite(v))?+v.toFixed(4):null, out={};
  for(const p of B.prodOrder){
    const C=ctxFor(B,R,p,today,over),f=figuresOf(C,p),ids=tierCustomers(C),floors={};
    Object.keys(f.floors).forEach(q=>{floors[q]={floor:r4(f.floors[q].floor)};});
    const cards={};
    ids.forEach(id=>{const r=[];shownSizes(C,p).forEach(q=>{const x=cardQuote(C,p,id,q);if(x!=null&&isFinite(x))r.push([q,x]);});if(r.length)cards[id]=r;});
    let lift=null,suggest=null;
    if(pctBook(C,p)){lift={};suggest=driftBook(C,p)?{}:null;ids.forEach(id=>{if(isPartner(C,id)){lift[id]='partner';return;}const d=driftOf(C,p,id);if(d&&typeof d.d==='number'&&isFinite(d.d))lift[id]=d.d;const g=suggestOf(C,p,id);if(g&&suggest)suggest[id]={pct:g.pct,why:PRICING_ENGINE.suggestWhy(g).join(', ')};});}
    out[p]=Object.assign({stockCost:r4(f.stockCost), replCost:r4(f.replCost), floors, inputs:f.inputs, sizes:f.sizes, rungs:f.rungs,
      ladder:(f.ladder||[]).map(r=>Object.assign({q:r.q,prices:r.prices,fixed:!!r.fixed},r.drift?{drift:true}:{})), cards, partners:B.partners.slice()},
      lift?{lift,suggest}:{},
      /* 11 Nov 2026: the day's market move, its reason and his switch, for the drafter, Salt Admin and the price list's reader */
      (m=>m?{market:{day:m.day,k:m.k,on:m.on!==false&&!m.before,why:marketWhy(m)}}:{})(marketOf(C,p)));
  }
  return out;
}

return {pSales,pPurch,openingFor,countedFor,posInputs,stockCost,hiddenFor,setPricesFor,sizesFor,shownSizes,shSizes,ladderFor,
  latestLot,meanLotQty,priceLockState,delShare,avgDelivery,replRate,replCost,quoteRate,freightRate,leakCharge,shrinkRate,nrsShare,heldBefore,
  inputs,policy,fiveTiers,figures,
  ruleFor,shelfAt,marketCover,marketPace,marketWalk,marketOf,marketK,marketWhy,marketReplay,priceReading,marketScore,switchOn,
  ownerOf,isResellAcct,isPerson,pbPriced,isPartner,lateOf,buyerProfile,driftBook,pctBook,driftSignals,driftOfNow,driftOf,suggestOf,tierCustomers,cost,cardQuote,pricing};
})();

export default SNAPSHOT_ENGINE;
