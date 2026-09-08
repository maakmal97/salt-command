/* engine/pricing.mjs: THE PRICING ENGINE, OUT OF THE DESK (move 1 of the rebuild, 22 Aug 2026).
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
      REVERSED, ROUND 5, HIS CALL 2 OF 29 AUG: replacement is the TRAILING 30-DAY
      QUANTITY-WEIGHTED AVERAGE purchase rate, per book, handed in as I.repl (the desk's
      pxInputs computes it; pxRecentBuyRate over lots received in the window, falling back
      to the most recent lot's rate when nothing was bought in 30 days, never undefined).
      The old argument above stays because it is the case against this setting: a single
      cheap lot no longer drops the whole board the day it lands, and a single dear one no
      longer spikes it, which is what the average buys; what it costs is that the board can
      sit under the latest lot for up to a month after a genuine rise. The latest lot's rate
      remains the fallback when no I.repl is supplied, so the stack cannot go undefined;
   2. freight, spread over the AVERAGE lot this book has received rather than over whichever
      one arrived last (v381, his instruction): a trip is a recurring cost and the lots keep
      coming, so pinning it to the last purchase made the figure swing on nothing. Oil's
      freight went RM1.20 to RM2.00 a unit when a 30-unit buy followed two 50-unit ones, and
      every oil floor moved with it. The mean settles as the book grows; the latest lot is
      still the fallback while a product has no history to average;
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
  /* 1. WHAT THE GOODS COST. Round 5: the trailing average where the desk supplies one
     (I.repl), else the rate on the latest lot, else the highest live quote. */
  const L=I.lot;
  const lot=pxOver.cost!=null?+pxOver.cost:(I.repl!=null?+I.repl:(L?L.rate:I.quoteRate));
  /* 2. GETTING THEM HERE. Spread over the AVERAGE lot received, not the latest one (v381).
     lotQty stays the latest lot because the rest of the stack reports on the lot in hand;
     only the freight divisor moves to the mean. A product with no averaged history falls
     back to the lot, so nothing is undefined on the first purchase of a new book. */
  const lotQty=(pxOver.cost!=null&&L)?L.qty:(L?L.qty:null);
  const freightQty=(I.meanLot>0)?I.meanLot:lotQty;
  /* v384: AND THE LOCK SWITCH IS OBEYED HERE, WHICH IT WAS NOT. lockBase is populated whether the
     lock is on or off, so LKb is truthy on both books, and this line and the delivery one below
     guarded only on `LKb && an override`. The leak two steps down guards on `I.lockOn && LKb`.
     So any probe that set a cost silently took the 06 Aug lock's FROZEN freight and delivery while
     the leak stayed live: one cost stack, two components frozen and one not, on a lock switched
     OFF. v382 is what made it visible, by moving live freight away from the frozen figure. */
  /* v503, his instruction of 07 Sep 2026: freight is TYPED ON EACH LOT. I.freightRate is the desk's
     reading of those figures per unit over the same window as the replacement rate, and it wins;
     the stated trip cost over the average lot is the fallback for a book with no typed freight. */
  const freight=(I.lockOn&&LKb&&pxOver.cost!=null)?LKb.freight:(I.freightRate!=null?+I.freightRate:(freightQty?COST_BASIS.freightPerTrip.rm/freightQty:0));
  const landed=lot+freight;                   // <- IAS 2 inventoriable cost, and nothing below this line is
  /* 3. THE UNITS THAT NEVER REACH A PAYING CUSTOMER. It divides rather than adds: losing 8% of
     what you buy means the 92% that sells has to return the cost of 100%. When a lock exists and
     only the cost is being probed, the leak is held at the locked figure (v240); off the locked
     path it reads live (v280). */
  const raw=pxOver.shrink!=null?+pxOver.shrink/100:((I.lockOn&&LKb)?LKb.shrinkRaw:I.shrinkRate);
  /* v504, his instruction of 07 Sep 2026: THE LEAK IS CHARGED IN FULL FROM THE COUNTS. I.leak is
     the desk's reading of the last three count cycles: the units missing at each count, over the
     units sold in those cycles, as a ratio; every lost unit, whatever it was used for, priced at
     landed and carried by the units that sell. Where no cycle can be read the lifetime share
     and the attribution lever stand in, exactly as before. */
  const lc=(pxOver.shrink==null&&I.leak&&I.leak.ratio!=null)?+I.leak.ratio:null;
  const sh=lc!=null?lc/(1+lc):raw*SHRINK_ATTRIB;
  const yielded=lc!=null?landed*(1+lc):landed/Math.max(0.01,1-sh);
  /* 4. GETTING THEM TO THE CUSTOMER. Per order, so divided by what an average order carries. */
  const del=(I.lockOn&&LKb&&pxOver.cost!=null)?{n:LKb.delN,mean:LKb.avgDel}:I.avgDel;   // v384: see the freight note above
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
          /* v403: gated on lockOn. With the lock off there is nothing to be stale AGAINST,
             and the ungated read was a constant true on this desk since PRICE_LOCK_ON went
             false: a flag that always fires teaches its reader to ignore it. No current
             consumer reads it; the gate is so the first one that does is not lied to. */
          stale:(I.lockOn&&LK.state==='stale'),sim:(pxOver.cost!=null||pxOver.shrink!=null)};
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
/* v504: THE ASK IS A MARGIN ON THE FLOOR, one basis (his instruction, 07 Sep 2026). The floor is
   what a size costs to take out; the margin on price slides with size on the same supplier taper
   the markup used, pinned at anchorG on anchorQ and clamped between gLo and gHi. A LADDER with
   no anchorG keeps the markup road. */
function ladderMargin(q,P){
  const LADDER=P.LADDER; if(LADDER.anchorG==null)return null;
  const lo=LADDER.at.lo, hi=LADDER.at.hi;
  const x=Math.min(hi,Math.max(lo,+q||lo));
  const T=(typeof LADDER.taper==='number')?{b:LADDER.taper}:buyTaper(P.tiers);
  const b=(T&&T.b!=null)?T.b:0;
  const g=LADDER.anchorG*Math.pow(x/LADDER.anchorQ,b);
  return Math.min(LADDER.gHi!=null?LADDER.gHi:0.9,Math.max(LADDER.gLo!=null?LADDER.gLo:0,g));
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
    const fl=floorTotal(q,C,P);
    const g=ladderMargin(q,P);
    let p=(set!=null&&+set>0)?+set:(g!=null?ladderRound(fl/(1-g),LADDER):ladderRound(cogs*(1+ladderMarkup(q,P)),LADDER));
    if(q>0&&prevRate<Infinity&&p/q>prevRate+1e-9){
      const stepped=Math.floor((prevRate*q+1e-9)/LADDER.round.to)*LADDER.round.to;
      const least=g!=null?fl:cogs*(1+LADDER.floor);   // never step down through the floor
      /* 08 Sep 2026: NOR ONTO IT. `>=least-0.009` let the step land exactly on the floor, and the
         floor guard below then had nothing to lift, against its own rule that an ask equal to its
         refusal line is not an ask. Where no grid step holds the rate flat above the floor, the
         floor wins over the rate law, which is the order v352 wrote down. */
      if(stepped>0&&stepped>least+0.009)p=stepped;
    }
    /* v352: AND NEVER UNDER THE FLOOR, WHICH IS THE HOUSE RULE ALREADY WRITTEN DOWN. v263 put it
       plainly: a price above its floor that breaks a rate taper is a decision the desk can defend,
       one below its floor is not. The markup ladder and the floor are struck on different bases, so
       nothing had ever forced them to agree, and charging the whole leak and his own time at v352
       pushed one ask under: oil at its 10 unit minimum asked RM140 against a floor of RM146.27,
       because 34 of the 105 unit ever bought were given away and the price now carries that.
       IT RAISES TO THE NEXT GRID STEP ABOVE THE FLOOR, never to the exact floor, because an ask
       equal to its refusal line leaves nothing and is not an ask. */
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
/* The lot cost a price has to beat: the salt, after the leak. DELIVERY IS NOT IN IT (v502, his
   instruction of 07 Sep 2026): delivery is a figure typed on the order, not a cost the floor
   carries, and there is one floor per size, not a collected one and a delivered one. `opts` is
   still accepted so the desk's older callers run; it changes nothing. */
function lotCost(q,C,opts){
  const per=(C.effEx!=null?C.effEx:C.eff);
  return +(per*q).toFixed(4);
}
/* ============ THE FLOOR IS BREAK-EVEN, AND HAS NOTHING ABOVE IT ============
   THE FLOOR CARRIED A 33% MARKUP AND THEREFORE WAS NOT A FLOOR. His instruction, 27 Aug 2026:
   "Floor Price (based on derived cost only without margin)". Two legs used to be taken, whichever
   bit harder: cogs at LADDER.floor, and the real cost of serving the order. The first is a MARGIN,
   and a refusal line with a margin inside it refuses trades that make money. It is gone. What is
   left is what an order actually costs: the salt after the leak, one delivery unless he collects,
   his own time at timePerOrder, and minPerUnit where a policy sets one.
   SO THE FLOOR NOW MEANS BREAK-EVEN AND AN ASK SITTING ON IT EARNS NOTHING. That is a different
   sentence from the one this line used to carry, which was "the least you should accept", and
   every surface printing the figure has to say the new one.
   IT MOVED NOT ONE ASK ON EITHER BOOK, at any size, measured before it shipped. ladderWalk's floor
   guard only ever RAISES an ask to clear the floor, and no ask is floor-lifted on this cost stack,
   so lowering the line could only remove a lift that was not there. The change is purely to the
   refusal line: the serving cost overtakes the old markup leg at 2.5 unit of salt, with the gap
   reaching RM144 at 12.5, and at 20 unit of oil, reaching RM81 at 50.
   LADDER.floor IS STILL READ, by ladderWalk, as the line a rate-law step-down may not pass
   through. That is a different job from this one and it keeps the name.
   v234: built per LOT, so delivery is floored once per order and not once per unit. A named lot
   floor is kept as a mechanism and is empty as a policy. */
function floorTotal(q,C,P,eff,opts){
  const per=eff!=null?eff:(C.effEx!=null?C.effEx:C.eff);
  const del=0;   // v502: delivery is an input per order, never part of the floor; see lotCost
  /* v352: AN ORDER COSTS HIM TIME AND THE FLOOR SAYS SO. Nothing in this stack had ever paid him
     for the work: the whole margin was doing it, undifferentiated from the return on his capital,
     so he could not tell profit from wages. timePerOrder is charged PER ORDER and not per unit,
     because that is how the work actually falls: a half unit and a twelve and a half take about
     the same handling. It sits beside delivery for the same reason, and like delivery it is a
     real cost that a small order struggles to carry. */
  let t=(per*q+del+(P.timePerOrder||0))+(P.minPerUnit||0)*q;
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
  const fl=floorTotal(q,C,P);
  out.floor={total:+fl.toFixed(2),rate:+(fl/q).toFixed(2),
             markup:+((fl/cogs-1)*100).toFixed(2),markupX:+(fl/cogs-1).toFixed(4),
             margin:+(((fl-lot)/fl)*100).toFixed(1)};
  /* v504: the ask is the floor at the size's margin, rounded up; the markup fields beside it are
     derived back from the answer, never assumed */
  const g=ladderMargin(q,P);
  out.marginX=g!=null?+g.toFixed(4):null;
  if(g!=null){const p=ladderRound(fl/(1-g),LADDER);out.ask={total:p,rate:+(p/q).toFixed(2),markup:+((p/cogs-1)*100).toFixed(2),markupX:+(p/cogs-1).toFixed(4),margin:+(((p-lot)/p)*100).toFixed(1)};}
  else out.ask=at(m,true);
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
/* v502: ONE FLOOR PER SIZE. The collected/delivered pair and deliveryCharge are gone with the
   delivery cost: a floor is the goods after the leak, and what an order carries for delivery is
   typed on the order. `floors[q].floor` is the one figure. */
function board(sizes,C,P){
  const f={};
  const asks=ladderRow(sizes,C,P);
  sizes.forEach(q=>{
    try{
      const x=floorTotal(q,C,P);
      f[q]={floor:(typeof x==='number')?+x.toFixed(2):null};
    }catch(e){ f[q]=null; }
  });
  return {floors:f, sizes:sizes.slice(), tiers:asks,
          timePerOrder:+(P.timePerOrder||0).toFixed(2)};
}

return {costStack:costStack,buyTaper:buyTaper,ladderMarkup:ladderMarkup,ladderMargin:ladderMargin,ladderCogs:ladderCogs,
        ladderRound:ladderRound,ladderWalk:ladderWalk,ladderAsk:ladderAsk,lotCost:lotCost,
        floorTotal:floorTotal,priceLadder:priceLadder,ladderRow:ladderRow,board:board};
})();
export default PRICING_ENGINE;
