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

/* a book's moved figures, the Worker's road: the walk is made here, and nothing else is read */
function figures(B,R,prod,today,over=null){
  const C0={B,R,today,over,W:{buyUnits:0,selfUse:0,wavgBuy:0,stockCost:null}};
  const W=POSITION_ENGINE.walk(posInputs(C0,prod)),C={...C0,W};
  const cost=PRICING_ENGINE.costStack(inputs(C,prod)),P=policy(C,prod),sizes=sizesFor(C,prod),floors={};
  sizes.forEach(q=>{floors[q]={floor:PRICING_ENGINE.floorTotal(q,cost,P)};});
  return {stockCost:W.stockCost, replCost:replCost(C,prod), inputs:{cost:inputs(C,prod),policy:P}, sizes, floors,
    rungs:shSizes(C,prod), ladder:fiveTiers(C,prod,()=>cost)};
}

return {pSales,pPurch,openingFor,countedFor,posInputs,stockCost,hiddenFor,setPricesFor,sizesFor,shownSizes,shSizes,ladderFor,
  latestLot,meanLotQty,priceLockState,delShare,avgDelivery,replRate,replCost,quoteRate,freightRate,leakCharge,shrinkRate,
  inputs,policy,fiveTiers,figures};
})();

export default SNAPSHOT_ENGINE;
