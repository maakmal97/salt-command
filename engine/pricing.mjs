/* engine/pricing.mjs — THE PRICING ENGINE, OUT OF THE DESK (move 1 of the rebuild, 22 Aug 2026).
 *
 * ONE DEFINITION. The desk, the payload build and the cloud drafter all price from this file.
 * The desk does not import it at runtime, because the desk is a single self-contained page that
 * must open from disk and load nothing: instead this file is INLINED into master/salt_command.html
 * between two markers by `node tools/engine.mjs --sync`, and CI fails if the inlined block is not
 * this file to the byte. The desk's own floorTotal(), priceLadder(), pxCost() and the rest are
 * now one-line wrappers that gather the inputs from the book and call in here. So there is one
 * engine, proved rather than trusted, which is the rule that v205, v284 and v330 exist for.
 *
 * PURE. Nothing here reads a global, the document or the clock. Every function takes:
 *   C  the cost stack for the product, as costStack() returns it
 *   P  the policy: {LADDER, minPerUnit, lotFloor, tiers, boardSizes}
 *      LADDER      the house ladder (floor, ceiling, anchorQ, anchorX, at, round, taper)
 *      minPerUnit  the least a unit may earn, in ringgit (PRICE_ENGINE.minPerUnit)
 *      timePerOrder what an order of his own time costs, in ringgit (PRICE_ENGINE.timePerOrder)
 *      lotFloor    named floors by size (PRICE.lotFloor), kept as a mechanism, empty as a policy
 *      tiers       the supplier's live quote tiers, for the taper ({qty,total} each)
 *      boardSizes  the sizes the board quotes, for walking an off-board size against them
 *      stated      prices HE has set, by size, overriding the derived ask (PRICE_SET[product])
 * and costStack() takes the input record the desk's pxInputs() gathers (see there).
 *
 * PORTED VERBATIM. The bodies are the desk's, with the globals replaced by C, P and I. Every
 * comment that explains a decision moved with its code; the history stays in the changelog.
 *
 * THE FILE IS THE INLINE BLOCK PLUS ONE LINE. Keep the IIFE shape: the last line is the export
 * and the sync tool drops exactly that line. Nothing else about the text is transformed, so
 * what the tests import is what the desk runs. */
const PRICING_ENGINE=(function(){

/* ============ THE COST STACK (v232, v233, v240, v280) ============
   What a unit costs to put in front of a customer, in four components, each tagged for IAS 2.
   1. the rate on the latest lot, not a 30-day average: a price set today has to replace today;
   2. freight, spread over the lot it arrived on, so a big lot carries it thinly;
   3. the leak: the units that never reach a paying customer divide the cost rather than add to
      it, and SHRINK_ATTRIB says how much of the leak the price carries;
   4. delivery, a per-ORDER cost divided by what an average order actually carries, and
      weighted by the share of orders that are DELIVERED at all: four in five customers come
      and collect, so the blended figure in eff is a fifth of one delivery. delPerOrder stays
      the FULL cost of one delivery, because that is what a delivered order has to carry.
   THE LOCKED PATH COMES FIRST. When the board is frozen on the current lot the snapshot is
   returned verbatim and nothing below runs; a simulator override bypasses the lock because
   testing a hypothetical lot is the one time a fresh number is wanted. The lock has been OFF
   since v280 (the cost moves live) and the path is kept so the desk can freeze again. */
function costStack(I){
  const LK=I.lockState||{state:'none',lock:null,days:null}, LKb=I.lockBase||null;
  const pxOver=I.over||{cost:null,shrink:null};
  const SHRINK_ATTRIB=I.attrib, COST_BASIS=I.costBasis;
  if(I.lockOn&&LK.state==='locked'&&pxOver.cost==null&&pxOver.shrink==null){
    const L=LK.lock;
    return {repl:+L.lot.rate.toFixed(2),lot:L.lot.rate,freight:L.freight,
            landed:L.landed,inventoriable:L.landed,
            shrink:L.shrink,shrinkRaw:L.shrinkRaw,attrib:SHRINK_ATTRIB,
            sampleLoad:L.sampleLoad,txn:L.txn,avgDel:L.avgDel,delN:L.delN,
            lotQty:L.lot.qty,lotDate:L.lot.date,
            absorbed:L.absorbed,eff:L.eff,effEx:+(L.landed/Math.max(0.01,1-L.shrink)).toFixed(6),
            delPerOrder:COST_BASIS.txnPerDelivery.rm,
            locked:true,lockedOn:L.lockedOn,lockAge:LK.days};
  }
  /* 1. WHAT THE GOODS COST. The rate on the latest lot, else the dearest live quote. */
  const L=I.lot;
  const lot=pxOver.cost!=null?+pxOver.cost:(L?L.rate:I.quoteRate);
  /* 2. GETTING THEM HERE. Spread over the lot it arrived on. */
  const lotQty=(pxOver.cost!=null&&L)?L.qty:(L?L.qty:null);
  const freight=(LKb&&pxOver.cost!=null)?LKb.freight:(lotQty?COST_BASIS.freightPerTrip.rm/lotQty:0);
  const landed=lot+freight;                   // <- IAS 2 inventoriable cost, and nothing below this line is
  /* 3. THE UNITS THAT NEVER REACH A PAYING CUSTOMER. It divides rather than adds: losing 8% of
     what you buy means the 92% that sells has to return the cost of 100%. When a lock exists and
     only the cost is being probed, the leak is held at the locked figure (v240); off the locked
     path it reads live (v280). */
  const raw=pxOver.shrink!=null?+pxOver.shrink/100:((I.lockOn&&LKb)?LKb.shrinkRaw:I.shrinkRate);
  const sh=raw*SHRINK_ATTRIB;
  const yielded=landed/Math.max(0.01,1-sh);
  /* 4. GETTING THEM TO THE CUSTOMER. Per order, so divided by what an average order carries. */
  const del=(LKb&&pxOver.cost!=null)?{n:LKb.delN,mean:LKb.avgDel}:I.avgDel;
  const txn=del.mean?(COST_BASIS.deliveredShare.v*COST_BASIS.txnPerDelivery.rm)/del.mean:0;
  const eff=yielded+txn;
  return {repl:+lot.toFixed(2),lot:+lot.toFixed(4),freight:+freight.toFixed(4),
          landed:+landed.toFixed(4),inventoriable:+landed.toFixed(4),
          shrink:sh,shrinkRaw:raw,attrib:SHRINK_ATTRIB,
          sampleLoad:+(yielded-landed).toFixed(4),
          txn:+txn.toFixed(4),avgDel:del.mean,delN:del.n,
          lotQty:lotQty,lotDate:L?L.date:null,
          absorbed:+(landed/Math.max(0.01,1-raw)-yielded).toFixed(4),
          eff:+eff.toFixed(4),
          /* GOODS ONLY, per unit. eff spreads the per-ORDER delivery over an average order, which
             is the right headline and the wrong thing to multiply by a lot size. Anything that
             prices a specific quantity uses effEx and adds delivery once. */
          effEx:+yielded.toFixed(6),delPerOrder:COST_BASIS.txnPerDelivery.rm,
          locked:false,lockedOn:null,lockAge:null,
          stale:(LK.state==='stale'),sim:(pxOver.cost!=null||pxOver.shrink!=null)};
}

/* ============ THE SUPPLIER'S OWN ELASTICITY, FITTED RATHER THAN TYPED ============
   Least squares of ln(rate) on ln(qty) across every tier of the live quote. It returns the
   exponent and the r-squared, and the r-squared is reported rather than hidden: a ladder that
   does not actually follow a power law should not have one fitted to it silently. */
function buyTaper(tiers){
  const q=Array.isArray(tiers)?tiers:[];
  const pts=q.filter(t=>t&&t.qty>0&&t.total>0).map(t=>({x:Math.log(t.qty),y:Math.log(t.total/t.qty)}));
  if(pts.length<2)return {b:null,r2:null,n:pts.length,why:'fewer than two quoted tiers'};
  const n=pts.length, mx=pts.reduce((a,p)=>a+p.x,0)/n, my=pts.reduce((a,p)=>a+p.y,0)/n;
  let num=0,den=0; pts.forEach(p=>{num+=(p.x-mx)*(p.y-my);den+=(p.x-mx)*(p.x-mx);});
  if(!(den>0))return {b:null,r2:null,n:n,why:'every tier is the same size'};
  const b=num/den, a=my-b*mx;
  let ss=0,sr=0; pts.forEach(p=>{ss+=Math.pow(p.y-my,2);sr+=Math.pow(p.y-(a+b*p.x),2);});
  return {b:+b.toFixed(5), r2:ss>0?+(1-sr/ss).toFixed(4):null, n:n, why:null};
}
/* the markup this size is asked, sliding ceiling to floor in the log of size. Outside the two
   anchors it is clamped rather than extrapolated: a 25 unit lot is asked the 12.5 markup and not
   a markup the policy never stated. */
function ladderMarkup(q,P){
  const LADDER=P.LADDER;
  const lo=LADDER.at.lo, hi=LADDER.at.hi;
  const x=Math.min(hi,Math.max(lo,+q||lo));
  /* the ask per unit falls with size at the supplier's own exponent, pinned to one anchor. Written
     on the RATE rather than on the markup because that is the thing being made proportionate: a
     markup is a ratio to cost, and cost per unit does not move with the size of a SALE. */
  const T=(typeof LADDER.taper==='number')?{b:LADDER.taper}:buyTaper(P.tiers);
  const b=(T&&T.b!=null)?T.b:0;                       // no measurable taper means a flat ladder, stated
  const rate=(1+LADDER.anchorX)*Math.pow(x/LADDER.anchorQ,b);
  return Math.min(LADDER.ceiling,Math.max(LADDER.floor,rate-1));
}
/* COGS for a lot: the landed cost, which is the lot rate plus freight and nothing else. It is
   the IAS 2 inventoriable figure and deliberately NOT the pricing basis the old rungs used. */
function ladderCogs(q,C){
  const per=(C.landed!=null?C.landed:C.eff);
  return +(per*q).toFixed(4);
}
/* the house rounding, and it is UP. A floor is never rounded. */
function ladderRound(v,LADDER){const to=LADDER.round.to; return LADDER.round.up?Math.ceil(v/to)*to:Math.round(v/to)*to;}
/* ============ THE RATE MAY NOT RISE WITH SIZE, AND ROUNDING UP IS WHAT BREAKS IT (v328) ============
   Nobody should pay more per unit for taking more. The markup curve cannot break that law on its
   own; ROUNDING UP TO THE TEN can, and on oil it did. THE REPAIR IS ONE GRID STEP DOWN, NEVER A
   DIFFERENT PRICE: where rounding up would lift the rate above the size below, the ask drops to
   the largest ten that holds the rate flat, and only if that still clears the floor. IT WALKS
   FORWARD because each answer depends on the one below it. */
function ladderWalk(sizes,C,P){
  const LADDER=P.LADDER;
  const out=[]; let prevRate=Infinity;
  sizes.forEach(q=>{
    const cogs=ladderCogs(q,C);
    /* v353: A PRICE HE HAS SET WINS OVER THE DERIVED ONE, and then obeys the same two laws.
       The board has been fully derived since v326, which is right as a default and wrong as an
       absolute: he is the one who meets the customer. A stated price replaces the markup and
       nothing else, so the rate-may-not-rise walk below and the floor guard beneath it both
       still run on it. Setting one price therefore MOVES THE SIZES ABOVE IT, because a bigger
       lot may never cost more per unit, and that is the honest consequence rather than a fault.
       A stated price under its own floor is not honoured; the floor guard lifts it and says so. */
    const set=(P.stated||{})[String(q)];
    let p=(set!=null&&+set>0)?+set:ladderRound(cogs*(1+ladderMarkup(q,P)),LADDER);
    if(q>0&&prevRate<Infinity&&p/q>prevRate+1e-9){
      const stepped=Math.floor((prevRate*q+1e-9)/LADDER.round.to)*LADDER.round.to;
      const least=cogs*(1+LADDER.floor);          // never step down through the floor
      if(stepped>0&&stepped>=least-0.009)p=stepped;
    }
    /* v352: AND NEVER UNDER THE FLOOR, WHICH IS THE HOUSE RULE ALREADY WRITTEN DOWN. v263 put it
       plainly: a price above its floor that breaks a rate taper is a decision the desk can defend,
       one below its floor is not. The markup ladder and the floor are struck on different bases, so
       nothing had ever forced them to agree, and charging the whole leak and his own time at v352
       pushed one ask under: oil at its 10 unit minimum asked RM140 against a floor of RM146.27,
       because 34 of the 105 unit ever bought were given away and the price now carries that.
       IT RAISES TO THE NEXT GRID STEP ABOVE THE FLOOR, never to the exact floor, because an ask
       equal to its refusal line leaves nothing and is not an ask. */
    const fl=floorTotal(q,C,P,null,{collects:true});
    if(fl>p+0.009)p=Math.ceil((fl+0.009)/LADDER.round.to)*LADDER.round.to;
    out.push({q:q,p:p});
    if(q>0)prevRate=Math.min(prevRate,p/q);
  });
  return out;
}
/* the ask at ANY size, walked against the board sizes beneath it so an off-board quote is judged
   against prices the desk actually quotes rather than against a neighbour it invented. */
function ladderAsk(q,C,P){
  const board=Array.isArray(P.boardSizes)?P.boardSizes:[];
  const upTo=board.filter(s=>s<q-1e-9);
  upTo.push(q);
  const walked=ladderWalk(upTo,C,P);
  return walked[walked.length-1].p;
}
/* The lot cost a price has to beat: the salt, after the leak, plus ONE delivery for the order. */
function lotCost(q,C,opts){
  opts=opts||{};
  const per=(C.effEx!=null?C.effEx:C.eff);
  const del=opts.collects?0:(C.delPerOrder!=null?C.delPerOrder:0);
  return +(per*q+del).toFixed(4);
}
/* ============ THE FLOOR ============
   v234: built the way a price is, per LOT, so delivery is floored once per order and not once
   per unit. v280: ONE FLOOR AT ONE MARKUP, ACROSS EVERY SIZE; a markup on the lot cost cannot
   invert, because the lot cost only ever rises with quantity. v326: THE FLOOR IS ON THE SAME
   BASIS AS THE ASK, which is cogs, at the markup the policy states; the collects option is
   accepted and no longer changes the answer, since cogs carries no delivery. v245: whichever
   bites harder, the percentage or the ringgit per unit. A named lot floor is kept as a
   mechanism and is empty as a policy. */
function floorTotal(q,C,P,eff,opts){
  opts=opts||{};
  const per=eff!=null?eff:(C.effEx!=null?C.effEx:C.eff);
  const del=opts.collects?0:(C.delPerOrder!=null?C.delPerOrder:0);
  /* v352: AN ORDER COSTS HIM TIME AND THE FLOOR NOW SAYS SO. Nothing in this stack has ever
     paid him for the work: the whole margin was doing it, undifferentiated from the return on
     his capital, so he could not tell profit from wages. timePerOrder is charged PER ORDER and
     not per unit, because that is how the work actually falls: a half unit and a twelve and a
     half take about the same handling. It sits in the mpu leg beside delivery for the same
     reason, and like delivery it is a real cost that a small order struggles to carry. */
  let t=ladderCogs(q,C)*(1+P.LADDER.floor);
  const mpu=(per*q+del+(P.timePerOrder||0))+(P.minPerUnit||0)*q;
  if(mpu>t)t=mpu;
  const named=(P.lotFloor||{})[String(q)];        // kept as a mechanism, empty as a policy
  if(named!=null&&named>t)t=named;
  return +t.toFixed(2);
}
/* The reference prices at any size. The floor is exact, because rounding a floor down would put
   it under itself; the ask rounds UP to the ten, which is the house rule. MARGIN IS STRUCK ON THE
   LOT COST AND THE MARKUP ON COGS, and the two bases are meant to be different numbers. */
function priceLadder(q,C,P,opts){
  const LADDER=P.LADDER;
  const cogs=ladderCogs(q,C), lot=lotCost(q,C,opts), m=ladderMarkup(q,P);
  const out={q:q,cogs:+cogs.toFixed(2),lot:+lot.toFixed(2),perUnit:+(lot/q).toFixed(2),
             markupX:+m.toFixed(4)};
  const at=(mm,round)=>{const raw=cogs*(1+mm);const p=round?ladderRound(raw,LADDER):+raw.toFixed(2);
    return {total:p,rate:+(p/q).toFixed(2),markup:+(mm*100).toFixed(2),markupX:+mm.toFixed(4),
            margin:+(((p-lot)/p)*100).toFixed(1)};};
  /* v330: THE FLOOR COMES FROM floorTotal AND IS NOT RECOMPUTED HERE. One function answers, and
     the markup shown beside it is derived back from the answer rather than assumed. */
  const fl=floorTotal(q,C,P,null,{collects:opts&&opts.collects});
  out.floor={total:+fl.toFixed(2),rate:+(fl/q).toFixed(2),
             markup:+((fl/cogs-1)*100).toFixed(2),markupX:+(fl/cogs-1).toFixed(4),
             margin:+(((fl-lot)/fl)*100).toFixed(1)};
  out.ask=at(m,true);                 // the one price on the board
  /* the rounded figure above is what the curve alone asks; the walked one is what the board
     quotes, and they differ only where rounding up would have broken the rate law */
  {const walked=ladderAsk(q,C,P);
   if(walked!=null&&Math.abs(walked-out.ask.total)>0.009){
     out.ask={total:walked,rate:+(walked/q).toFixed(2),markup:+((walked/cogs-1)*100).toFixed(2),
              markupX:+(walked/cogs-1).toFixed(4),margin:+(((walked-lot)/walked)*100).toFixed(1),
              lawStepped:true};}}
  out.ceiling=at(LADDER.ceiling,true);
  return out;
}
/* ONE LADDER MEANS ONE ROW. It stays an array because that is the shape the phone maps over. */
function ladderRow(sizes,C,P){
  return [{
    code:'ASK', name:'Ask', who:'one ladder, graded by size, tapered as the supplier tapers',
    prices:sizes.map(q=>{try{const L=priceLadder(q,C,P);
      return L&&L.ask&&L.ask.total!=null?+L.ask.total:null;}catch(e){return null;}})
  }];
}
/* THE BOARD AND THE FLOORS, for quoting at the point of sale: what the phone receives. */
/* THE CARD IS A COLLECTION PRICE AND DELIVERY IS QUOTED ON TOP, PER ORDER (v352, his instruction).
   v344 charged delivery at its real RM50 and put a `deliverable` flag on every size saying whether
   the carded ask could also carry one. On the true figures it could not, at nearly every size, so
   the flag said the same thing everywhere and answered a question the board should not have been
   asking: four orders in five are collected, and pricing all of them as if they were delivered
   makes the collectors pay for the deliveries.
   SO THE BOARD IS ONE PRICE AND ONE CHARGE. `collected` is the floor the ask must clear and the
   basis the ask is struck on. `delivered` is that plus one delivery, which is what to quote when
   he is driving. `deliveryCharge` states the figure once so nothing has to derive it. The flag and
   the collectOnly list are gone: a flag whose answer never varies is noise. */
function board(sizes,C,P){
  const f={};
  const asks=ladderRow(sizes,C,P);
  sizes.forEach(q=>{
    try{
      const d=floorTotal(q,C,P), c=floorTotal(q,C,P,null,{collects:true});
      f[q]={collected:(typeof c==='number')?+c.toFixed(2):null,
            delivered:(typeof d==='number')?+d.toFixed(2):null};
    }catch(e){ f[q]=null; }
  });
  return {floors:f, sizes:sizes.slice(), tiers:asks,
          deliveryCharge:(C.delPerOrder!=null?+C.delPerOrder.toFixed(2):null),
          timePerOrder:+(P.timePerOrder||0).toFixed(2)};
}

return {costStack:costStack,buyTaper:buyTaper,ladderMarkup:ladderMarkup,ladderCogs:ladderCogs,
        ladderRound:ladderRound,ladderWalk:ladderWalk,ladderAsk:ladderAsk,lotCost:lotCost,
        floorTotal:floorTotal,priceLadder:priceLadder,ladderRow:ladderRow,board:board};
})();
export default PRICING_ENGINE;
