/* engine/snapshot.mjs: S1c-ii of the Book plan. THE COST GLUE THE PRICING SNAPSHOT NEEDS, PURE.
   These readers sat in the master's script and read its globals (PROD, TODAY, the book consts, pxOver, the walk's outputs), so only
   a desk in jsdom could build the Worker's PRICING. They take everything explicitly now, and the master's functions of the same
   names are one-line delegations (tools/engine.mjs inlines this file after the pricing engine, the import lines dropped; the
   engines are the globals of the same names there).

   C is the context every reader takes: { B, R, today, W, over }.
     B  the book: sales, purchases, opening (by book), statedStockBy, statedStock, loanDrawUnits() (a function: only salt reads it),
        supplierReceivable, counts, selfUseLog, quotes, priceSet, costRule, defaultProd
     R  the rules: COST_BASIS, SHRINK_ATTRIB, PRICE_LOCK, PRICE_ENGINE, LADDER_BY, TIER_RULE, TIER_NAMES (all in engine/rules.mjs),
        and the master's LADDER, PRICE and PRICE_LOCK_ON, which are not there yet (S1c-iii)
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
function delShare(C,p){
  const rows=pSales(C.B,p).filter(s=>!s.cancelled&&POSITION_ENGINE.txPhys(s)>0.009);
  const said=rows.filter(s=>s.handover==='delivered'||s.handover==='collected');
  const del=said.filter(s=>s.handover==='delivered');
  return said.length
    ? {v:del.length/said.length,delivered:del.length,said:said.length,of:rows.length,measured:true}
    : {v:C.R.COST_BASIS.deliveredShare.v,delivered:0,said:0,of:rows.length,measured:false};
}
function avgDelivery(C,p){
  const rows=pSales(C.B,p).filter(s=>!s.cancelled&&POSITION_ENGINE.txPhys(s)>0.009);
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
    (s.amend||[]).forEach(st=>{const k=+st.kg||0;if(st.kind!=='Fulfilment'||!(k>0))return;tr+=k;if(inWin(st.date||s.date))got+=k;});
    const rest=(+s.deliveredQty||0)-tr;
    if(rest>0&&inWin(s.deliveredOn||s.date))got+=rest;
    return a+got;},0);
  if(!(sold>0))return null;
  return {ratio:+(leak/sold).toFixed(4),leak:+leak.toFixed(2),sold:+sold.toFixed(2),cycles:last.length,from:start,to:end};
}
function sampleUnits(C,p){return C.B.selfUseLog.filter(r=>(r.product||C.B.defaultProd)===p&&r.why==='sample').reduce((a,r)=>a+(+r.kg||0),0);}
function shrinkRate(C,p){const h=C.W.buyUnits+openingFor(C.B,p).qty;
  return h>0?Math.max(0,C.W.selfUse-sampleUnits(C,p))/h:0;}

/* the records the pricing engine takes */
function inputs(C,p){
  const R=C.R,o=C.over||{cost:null,shrink:null};
  return {prod:p, lockOn:R.PRICE_LOCK_ON, lockState:priceLockState(C,p), lockBase:R.PRICE_LOCK[p]||null,
    over:{cost:o.cost,shrink:o.shrink}, lot:latestLot(C,p), meanLot:meanLotQty(C,p), quoteRate:quoteRate(C,p),
    repl:replRate(C,p), freightRate:freightRate(C,p), leak:leakCharge(C,p),
    costRule:(C.B.costRule||{})[p]||null,
    latest:(x=>x&&{rid:x.rid,date:x.date,quote:x.quote,freight:x.freight,units:x.units,rate:x.rate})(POSITION_ENGINE.latestCogs(pPurch(C.B,p))),
    costBasis:{freightPerTrip:{rm:R.COST_BASIS.freightPerTrip.rm},txnPerDelivery:{rm:R.COST_BASIS.txnPerDelivery.rm},
      deliveredShare:{v:delShare(C,p).v}},
    attrib:R.SHRINK_ATTRIB, shrinkRate:shrinkRate(C,p), avgDel:avgDelivery(C,p)};
}
function policy(C,p){
  const R=C.R,pq=C.B.quotes[p]||null;
  return {LADDER:ladderFor(C,p), minPerUnit:R.PRICE_ENGINE.minPerUnit||0, timePerOrder:R.PRICE_ENGINE.timePerOrder||0, lotFloor:R.PRICE.lotFloor||{},
    stated:setPricesFor(C,p),
    tier1:ladderFor(C,p).tier1||null,
    tierRule:R.TIER_RULE[p]||null,
    lastLevel:R.TIER_NAMES[R.TIER_NAMES.length-1],
    tiers:(pq&&pq.tiers)?pq.tiers:[],
    boardSizes:sizesFor(C,p)};
}
/* the five tiers for a book, on its own rungs; null for a book with no rule. `cost` is a function, read only when there is a rule */
function fiveTiers(C,p,cost){
  const R=C.R.TIER_RULE[p];
  const sizes=R?R.rungs.concat(sizesFor(C,p).filter(q=>!R.rungs.some(r=>Math.abs(r-q)<0.009))).sort((a,b)=>a-b):null;
  return R?PRICING_ENGINE.fiveTiers(sizes,cost(),policy(C,p)):null;
}

/* S1c-iii: THE CARDS AND THE DRIFT. Whose account a code is, who is a person, who pays cost, and what each customer is quoted.
   Added to C: B.roster, B.partners, B.tierOf (the hand-set TIER_OF), B.prodOrder; R.RULES and R.PROFILE_RULE; and two hooks the desk
   fills and a Worker may leave out: C.memo(key,f), the render's cache (none: made fresh), and C.tierAt(code,q), the level machinery
   (tierProposal, ruleProposal), which no live book uses: without it a book that names levels quotes null, never a wrong figure. */
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
function driftOfNow(C,p,code){
  const R=C.R.TIER_RULE[p];if(!R||!R.drift)return null;
  const who=ownerOf(code)||code,h=(C.B.tierOf[who]||{})[p],hand=PRICING_ENGINE.driftOk(h)?+h:null;
  const sig=driftSignals(C,p,who),a=PRICING_ENGINE.autoDrift(sig,R.auto);
  return Object.assign({},a,{auto:a.d,hand:hand,d:hand!=null?hand:a.d,sig:sig});
}
function driftOf(C,p,code){return viaMemo(C,'drift|'+(ownerOf(code)||code)+'|'+p,()=>driftNowS(C,p,code));}
function tierCustomers(C){
  const rev={};
  C.B.sales.forEach(s=>{const o=ownerOf(s.customer);if(!o||!isPerson(o)||!(s.total>0)||POSITION_ENGINE.txStat(s).order==='Cancelled')return;rev[o]=(rev[o]||0)+s.total;});
  const rest=C.B.roster.map(ownerOf).filter((id,i,a)=>a.indexOf(id)===i&&isPerson(id)&&!id.startsWith('S')&&!(id in rev));
  return Object.keys(rev).sort((a,b)=>rev[b]-rev[a]).concat(rest);
}
function cost(C,p){const o=C.over||{cost:null,shrink:null};return viaMemo(C,'pxCost|'+p+'|'+o.cost+'|'+o.shrink,()=>PRICING_ENGINE.costStack(inputs(C,p)));}
/* a named customer's price at any size: a partner the floor to the sen; a stated board the board; a drift book the Set Price moved by their drift */
function cardQuote(C,p,code,q,t){
  if(!(q>0))return null;
  const o=C.over||{cost:null,shrink:null},K=cost(C,p),P=Object.assign({},policy(C,p),{tierRule:C.R.TIER_RULE[p]});
  if(isPartner(C,code))return PRICING_ENGINE.quoteAt(q,K,P,'partner');   // 06 Oct 2026, his decision: a partner pays cost, the floor to the sen
  const row=viaMemo(C,'tierAt|'+p+'|'+q+'|'+o.cost+'|'+o.shrink,()=>PRICING_ENGINE.fiveTierAt(q,K,P));
  if(row&&row.fixed)return PRICING_ENGINE.quoteAt(q,K,P,0);
  if(row&&row.drift){const dr=driftS(C,p,code);return PRICING_ENGINE.quoteAt(q,K,P,dr?dr.d:0);}
  if(t==null)t=C.tierAt?C.tierAt(code,q):-1;if(t<0)return null;
  if(!row||row.prices[t]==null)return null;
  return +PRICING_ENGINE.cardPrice(null,PRICING_ENGINE.floorTotal(q,K,policy(C,p)),row.prices[t]).toFixed(2);}

/* a book's moved figures, the Worker's road: the walk is made here, and nothing else is read */
function ctxFor(B,R,prod,today,over){
  const C0={B,R,today,over,W:{buyUnits:0,selfUse:0,wavgBuy:0,stockCost:null}};
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
    let drift=null;
    if(driftBook(C,p)){drift={};ids.forEach(id=>{if(isPartner(C,id)){drift[id]='partner';return;}const d=driftOf(C,p,id);if(d&&typeof d.d==='number'&&isFinite(d.d))drift[id]=d.d;});}
    out[p]=Object.assign({stockCost:r4(f.stockCost), replCost:r4(f.replCost), floors, inputs:f.inputs, sizes:f.sizes, rungs:f.rungs,
      ladder:(f.ladder||[]).map(r=>Object.assign({q:r.q,prices:r.prices,fixed:!!r.fixed},r.drift?{drift:true}:{})), cards, partners:B.partners.slice()},
      drift?{drift}:{});
  }
  return out;
}

return {pSales,pPurch,openingFor,countedFor,posInputs,stockCost,hiddenFor,setPricesFor,sizesFor,shownSizes,shSizes,ladderFor,
  latestLot,meanLotQty,priceLockState,delShare,avgDelivery,replRate,replCost,quoteRate,freightRate,leakCharge,shrinkRate,
  inputs,policy,fiveTiers,figures,
  ownerOf,isResellAcct,isPerson,pbPriced,isPartner,lateOf,buyerProfile,driftBook,driftSignals,driftOfNow,driftOf,tierCustomers,cost,cardQuote,pricing};
})();

export default SNAPSHOT_ENGINE;
