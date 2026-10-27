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
 *      tierRule    the book's rule: a stated board {fixed,rungs} or the Set Price {drift,points,rungs}; a book with
 *                  one IS its board, and the ask is the board's price (v656; the five levels went on 18 Oct 2026)
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
      cheap lot no longer drops the whole board the day it lands, and a single costly one no
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
  /* 05 OCT 2026, HIS SETTLED RULE: COGS IS THE LATEST PURCHASE, on every book (COST_RULE kind `latestCogs`). I.latest is
     the position engine's latestCogs over the book's lots: the latest landed lot's quote plus its trip freight, over its
     units. It replaces the trailing rate and the averaged freight below, and the leak and the delivery share come out of
     the pricing basis (step 6). A book with no landed lot falls through to the roads below, with no leak either way. */
  const LC=(I.costRule&&I.costRule.kind==='latestCogs'&&I.latest&&+I.latest.units>0)?I.latest:null;
  const lot=pxOver.cost!=null?+pxOver.cost:(LC?+LC.quote/+LC.units:(I.repl!=null?+I.repl:(L?L.rate:I.quoteRate)));
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
  const freight=LC?(+LC.freight||0)/+LC.units:(I.lockOn&&LKb&&pxOver.cost!=null)?LKb.freight:(I.freightRate!=null?+I.freightRate:(freightQty?COST_BASIS.freightPerTrip.rm/freightQty:0));
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
  let eff=yielded+txn;
  /* v553, HIS INSTRUCTION OF 09 SEP 2026, AND IT IS A PLACEHOLDER: "for oil, COGS is just the price
     to buy + 15%". The measured road above put RM1.81 of a RM9.64 effective cost on ONE drift
     figure, read from a single cycle whose opening anchor was seventeen days old and whose own
     COUNTS entry contradicts the roll that produced it. A flat markup on the buy rate is a coarser
     number and an honest one while oil has one cycle to its name.
     IT MOVES THE PRICING BASIS AND NOTHING ELSE. `landed` is the IAS 2 inventoriable figure and
     stays the true cost; `shrink` and `sampleLoad` keep reporting the leak the counts actually
     read, so the desk can still show what it is measuring while pricing off something else. The
     rule is DATA, in COST_RULE on the book, so the percentage moves without touching this file,
     and `rule`/`rulePct` travel with the stack so every surface can say which basis it is on. */
  /* 19 SEP 2026: TWO PRODUCTS, TWO STATED BASES (his instruction). Three kinds now, and a product
     with no rule still takes the stack, so nothing changes by omission:
       stack        the measured stack: replacement, freight, the leak, the delivery share. Salt's,
                    stated explicitly so the difference between the two books is written down rather
                    than being one of them merely lacking an entry.
       landed       purchase plus freight and NOTHING else. Oil's. He uses most of the oil himself,
                    so its leak is high by design and is never costed into a sale; it is still
                    measured and still reported, because that is a pricing decision and not a reason
                    to stop counting.
       buyPlusPct   a flat markup on the buy rate, which is what oil had as a PLACEHOLDER from
                    09 Sep. Kept because the mechanism is sound and a book may want it again. */
  /* 05 Oct 2026: `latestCogs`, his settled basis for every book: purchase plus freight off the latest lot (step 1 and 2
     above) and NOTHING else, so it prices exactly as `landed` does from there. The leak is still measured and reported,
     and `afterLeak` below carries the stack's after-leak figure for a surface to print as information; nothing prices
     off it. */
  const CR=I.costRule||null;
  const ruled=!!(CR&&CR.kind==='buyPlusPct'&&+CR.pct>=0);
  const landedRule=!!(CR&&(CR.kind==='landed'||CR.kind==='latestCogs'));
  if(ruled)eff=+(lot*(1+ +CR.pct/100)).toFixed(6);
  else if(landedRule)eff=+landed.toFixed(6);
  return {rule:(CR&&CR.kind)?CR.kind:null,rulePct:ruled?+CR.pct:null,rulePlaceholder:!!(ruled&&CR.placeholder),
          latest:LC?{rid:LC.rid||null,date:LC.date||null,quote:+LC.quote,freight:+LC.freight||0,units:+LC.units}:null,
          afterLeak:+yielded.toFixed(4),
          repl:+lot.toFixed(2),lot:+lot.toFixed(4),freight:+freight.toFixed(4),
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
          /* v553: and the RULED basis lands here too, because the FLOOR reads effEx, not eff. A rule
             that moved the headline and left the floor on the leak would have been the worst of
             both: a board priced one way and refused another. */
          effEx:ruled?+(lot*(1+ +CR.pct/100)).toFixed(6):(landedRule?+landed.toFixed(6):+yielded.toFixed(6)),delPerOrder:COST_BASIS.txnPerDelivery.rm,
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
    /* v552, HIS INSTRUCTION OF 09 SEP 2026: A PRICE HE HAS STATED IS QUOTED, EVEN UNDER ITS FLOOR.
       "The desk quotes to 450, by lowering margin." v353 said a stated price under its own floor is
       not honoured and the guard lifts it; that is now true of a DERIVED ask only. The reason the
       rule was written still stands for a derived one: the ladder and the floor are struck on
       different bases, nothing forces them to agree, and an ask the desk invented below break-even
       is a fault. A price HE set below break-even is not a fault, it is a decision, and the desk's
       job is to quote it and say what it costs rather than to overrule him at the counter.
       WHAT IT COSTS IS NAMED, NOT HIDDEN: `under` is the gap to break-even, and every surface that
       prints an ask reads it. Oil's 50 unit tier is the whole of it today, RM450 against a floor of
       RM482.20, so the desk quotes RM450 and reports it as 0.93x of break-even. The board's other
       four sizes are untouched: they clear their floors already and his ladder steps the margin
       down proportionately into this one. */
    let under=0;
    if(fl>p+0.009){
      if(set!=null&&+set>0&&Math.abs(p-+set)<0.009)under=+(fl-p).toFixed(2);
      else p=Math.ceil((fl+0.009)/LADDER.round.to)*LADDER.round.to;
    }
    out.push({q:q,p:p,under:under});
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
function costTotal(q,C,P,eff,opts){
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
/* 18 OCT 2026, HIS DECISION: THE FLOOR IS THE ORDER TOTAL ROUNDED UP TO THE NEXT RM 5 (P.floorTo, RULES.floorTo, 5; the one
   fallback below is for a hand-built policy that carries none). costTotal above is COGS times the size to the sen and nothing
   else: it is what a COST reader measures (margin on cost, a break-even rate, a probe that must stay straight-line in the
   buying rate). floorTotal is what a PRICE reader refuses, lifts, quotes a partner or boards against. A total a hair over a
   multiple of five by floating point (35.0000001) stays there, so the up-round never lifts an exact RM 35 to RM 40. */
const FLOOR_TO_FALLBACK=5;
function floorTotal(q,C,P,eff,opts){
  const t=costTotal(q,C,P,eff,opts), to=(P&&P.floorTo>0)?+P.floorTo:FLOOR_TO_FALLBACK;
  return +(Math.ceil(t/to-1e-6)*to).toFixed(2);
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
  /* v552: THE ASK AGAINST BREAK-EVEN, on whichever ask stands above. floorTotal IS the effective
     cost of the size, to the ringgit and at every size on both books, so this one multiple is the
     margin the board is actually taking: over 1.00x earns, 1.00x earns nothing, under 1.00x is a
     price he has stated below break-even and `under` says by how much. */
  /* THE BOARD IS THE SET PRICE (v656, his decision of 15 Sep 2026; the levels went on 18 Oct 2026). A book with a tierRule, a stated
     board or the Set Price, quotes that board's price at the size, so the ask at every size is the board rather than a margin
     derived on the floor. Everything downstream reads this ask: ladderRow's row zero, the board, the printed card, the guest
     links, enginePrice and every margin struck on the board. The derived figure is kept beside it as `derived`, with its own
     floorX and under, because the Pricing page shows the two against each other. A book with NO tierRule keeps the derived ask. */
  {const t=P.tierRule?fiveTierAt(q,C,P):null;
   const b=(t&&t.prices&&t.prices.length)?t.prices[t.prices.length-1]:null;
   if(b!=null&&isFinite(b)){
     out.ask.floorX=+(out.ask.total/Math.max(0.01,fl)).toFixed(3);
     out.ask.under=+Math.max(0,fl-out.ask.total).toFixed(2);
     out.derived=out.ask;
     out.ask={total:b,rate:+(b/q).toFixed(2),markup:+((b/cogs-1)*100).toFixed(2),
              markupX:+(b/cogs-1).toFixed(4),margin:+(((b-lot)/b)*100).toFixed(1),
              rung:t.rung,fromLadder:true};}}
  out.ask.floorX=+(out.ask.total/Math.max(0.01,fl)).toFixed(3);
  out.ask.under=+Math.max(0,fl-out.ask.total).toFixed(2);
  out.ceiling=at(LADDER.ceiling,true);
  return out;
}
/* ============ ONE ROW: THE SET PRICE ============
   18 Oct 2026, HIS DECISION: THE FIVE LEVELS ARE GONE. A book has the Floor, its Set Price and the Ceiling, and the board's one
   row is the Set Price, what a stranger is quoted. THE CODE STAYS 'T2' AND ROW ZERO STAYS LOAD BEARING: the phone, the D1 mirror,
   the Worker and the suite read [0] and choose by code, so renaming the code would break every one of them to say what the
   name already says. There is no second row. */
function ladderRow(sizes,C,P){
  const col=(k)=>sizes.map(q=>{try{const L=priceLadder(q,C,P);
    return L&&L[k]&&L[k].total!=null?+L[k].total:null;}catch(e){return null;}});
  return [{
    code:'T2', name:'Set Price', dflt:true,
    who:'what a stranger is quoted, the least any customer but a partner pays',
    prices:col('ask')
  }];
}
/* ============ 19 SEP 2026, HIS INSTRUCTION: A PRODUCT MAY HAVE ONE STATED PRICE ============
   "For oil, there will no longer be pricing tier since it is not the main product, just a single pricing
   tier. Start at 130 for 10 to 450 at 50. This is the only price for oil, fixed for all."
   A TIER_RULE carrying `fixed` is a board he has typed, one price a rung and the same for every customer.
   IT IS READ HERE AND NOWHERE ELSE, because fiveTiers is the one choke point every oil price passes: the
   guest boards call it directly, the desk's ask and cardQuote reach it through fiveTierAt, and the
   customer's page reads the snapshot's precomputed ladder. Stating the board anywhere else would have
   meant teaching five readers the same thing and watching them drift.
   THE FLOOR STILL BINDS. A stated price under its own floor is lifted clear of it exactly as a derived one
   is, because a price under break-even is not a price he can defend, and the lift says so.
   THERE IS NO RATE-MAY-NOT-RISE WALK on a stated board: he typed the rates and they fall by a ringgit a
   unit every ten, so a walk could only disagree with what he wrote. */
function fiveTiers(sizes,C,P){
  const R=P.tierRule;
  if(R&&R.fixed&&typeof R.fixed==='object'&&Array.isArray(R.rungs)&&R.rungs.length){
    const to=P.LADDER.round.to, up=v=>Math.ceil(v/to-1e-9)*to;
    const rungs=R.rungs.map(Number).sort((a,b)=>a-b);
    return sizes.map(q=>{
      let rung=0; rungs.forEach((r,i)=>{if(r<=q+0.009)rung=i;});
      const fl=floorTotal(q,C,P), cogs=Math.round(ladderCogs(q,C));
      /* the size's own stated price where it is a rung; between rungs the rung it falls in, pro rata on
         that rung's own rate, so a size he has not typed is still quoted at the rate he typed for it.
         ROUNDED DOWN, NEVER UP: the rate per unit may not rise as the order grows, which is one of the
         engine's four laws and the one a customer can check by hand. Rounded up, 15 unit came out at
         RM200, which is RM13.33 a unit against the RM13 he typed at 10. */
      const down=v=>Math.floor(v/to+1e-9)*to;
      const exact=R.fixed[String(q)];
      const base=R.fixed[String(rungs[rung])];
      let p=(exact!=null&&+exact>0)?+exact:((base!=null&&+base>0&&rungs[rung]>0)?down(+base*q/rungs[rung]):null);
      if(p==null)return {q:q,rung:rung,cogs:cogs,floor:+fl.toFixed(2),cols:[],prices:[up(fl)],fixed:true};
      if(p<fl-0.009)p=up(fl);
      /* 05 OCT 2026, HIS DECISION: AND A CEILING CAPS IT. A typed price over `ceilingX` times the floor comes down to the
         book's grid at or under that line, never under the floor's own lift; a typed price inside the band does not move. */
      const capX=+R.ceilingX>0?+R.ceilingX:null, cap=capX!=null?Math.max(down(capX*fl),up(fl)):null;
      const capped=cap!=null&&p>cap+0.009;
      if(capped)p=cap;
      return {q:q,rung:rung,cogs:cogs,floor:+fl.toFixed(2),cols:[p],prices:[up(fl),p],fixed:true,ceiling:cap,capped:capped};
    });
  }
  /* 05 OCT 2026, HIS DECISION: A BOOK WITH A `drift` RULE IS A SET PRICE, NOT A LADDER OF LEVELS (salt's Model B). Each
     size reads its floor, `up(floor)` in the first column as a stated board's does, and the Set Price, the last, which
     is what a stranger is quoted; a named customer is quoted the Set Price moved by their drift (driftAt below). */
  if(R&&R.drift&&Array.isArray(R.rungs)&&R.rungs.length){
    const to=P.LADDER.round.to, up=v=>Math.ceil(v/to-1e-9)*to, rungs=R.rungs.map(Number).sort((a,b)=>a-b);
    /* 05 OCT 2026, HIS DECISION: THE WHOLE GRID IS WALKED. The sizes asked for are walked with every point of the book's
       grid beneath them (walkSizes), so the board reads exactly what any quantity is quoted at, and the rate never rises
       across the grid; then the sizes asked for are read off that one walk */
    const all=driftWalk(walkSizes(R,sizes),C,P,0);
    return sizes.map(q=>all.find(x=>Math.abs(x.q-q)<0.009)).map(x=>{
      let rung=0; rungs.forEach((r,i)=>{if(r<=x.q+0.009)rung=i;});
      return {q:x.q,rung:rung,cogs:Math.round(ladderCogs(x.q,C)),floor:x.floor,cols:[x.set],prices:[up(x.floor),x.set],
              set:x.set,ceiling:x.ceiling,drift:true};
    });
  }
  return null;
}
/* ============ 18 OCT 2026, HIS DECISION: THE SET PRICE IS THE MINIMUM, AND A CUSTOMER'S FIGURE IS A % LIFT ON IT (salt) ============
   Per size three figures: the Floor (floorTotal, COGS times the size up to the next RM 5), the Ceiling (R.ceilingX times the
   floor, down to the grid) and the SET PRICE between them, the least any customer but a partner pays and what a stranger is quoted.
   The Set Price is the floor times a multiple (setMultiple) that slides in the log of size between R.points, [size, multiple]
   pairs, and is flat beyond the first and the last. THE WALK runs the grid smallest first and keeps one running rate r, EXACT
   and never compounded: r = the lesser of r and floor x multiple x (1 + pct) over the size; the price is r times the size down to
   the grid (RM 5); then lifted, to the grid, so that its ringgit margin over the floor never falls under the largest margin of any
   smaller size already walked; then held between the floor and the ceiling. The quoted rate may therefore rise by under one grid step over the
   size between two quarters: the law is on the exact rate, his choice. The margin lift is path dependent, so the one walk
   answers driftAt, quoteGrid and the board alike, every grid point from the grid's least up to the size asked.
   pct is the customer's held %, -0.3 to +0.3 (driftOk, LIFT_MIN to LIFT_MAX; his decision of 21 Oct 2026, which was 0 to 2), applied inside
   the walk to the multiple at every size; 0 is the Set Price. A negative % is a discount on it, still never under the Floor.
   Nothing automatic sets it: autoDrift reads the record for the card and prices nothing, and suggestPct only suggests. */
function setMultiple(q,R){
  const pts=(R.points||[]).map(x=>[+x[0],+x[1]]).filter(x=>x[0]>0&&isFinite(x[1])).sort((a,b)=>a[0]-b[0]);
  if(!pts.length)return 1;
  if(!(q>pts[0][0]))return pts[0][1];
  const last=pts[pts.length-1];
  if(q>=last[0])return last[1];
  for(let i=0;i<pts.length-1;i++){
    if(q<pts[i+1][0]){const a=pts[i],b=pts[i+1];return a[1]+(b[1]-a[1])*Math.log(q/a[0])/Math.log(b[0]/a[0]);}
  }
  return last[1];
}
/* a held % is a number from -0.3 to +0.3 (his decision of 21 Oct 2026); anything else is not one */
const LIFT_MIN=-0.3, LIFT_MAX=0.3;
function driftOk(v){return typeof v==='number'&&isFinite(v)&&v>=LIFT_MIN-1e-9&&v<=LIFT_MAX+1e-9;}
/* ============ 22 OCT 2026, HIS DECISION: THEIR % RUNS ON HIS CURVE, ON EVERY BOOK ============
   A book takes Their % when its rule is a Set Price (`drift`) or carries `pct` (a stated board, oil, candy and rice): pctBook.
   On a Set Price, `ends` {low:[at the first point, at the last], high:[...]} are the multiples of the Floor he set for -30% and
   +30%; each end curve keeps the Set Price's own shape (the share s of the way the Set Price sits between its first and last
   multiples, the same share between the end's two), and a % is that share of the way from the Set Price to its end, so every
   5% step is an equal step at every size. A rule with no `ends` keeps the multiple times (1 + %).
   On a stated board, `shares` {low:[at the smallest rung, at the largest], high:[...]} are what -30% and +30% make of his typed
   board, sliding in the log of size between the two rungs and flat beyond them, and a % is that share of the way from the board. */
function pctBook(R){return !!(R&&(R.drift||R.pct));}
function pctPos(pct){const k=driftOk(pct)?Math.max(LIFT_MIN,Math.min(LIFT_MAX,+pct)):0;return {k:k,t:k<0?k/LIFT_MIN:k>0?k/LIFT_MAX:0};}
function endPair(e){return Array.isArray(e)&&e.length===2&&e.every(v=>typeof v==='number'&&isFinite(v)&&v>0)?e:null;}
function driftMultiple(q,R,pct){
  const m=setMultiple(q,R),x=pctPos(pct);
  if(!R||!R.ends)return m*(1+x.k);
  if(!x.t)return m;
  const end=endPair(x.k<0?R.ends.low:R.ends.high);if(!end)return m;
  const pts=(R.points||[]).map(v=>[+v[0],+v[1]]).filter(v=>v[0]>0&&isFinite(v[1])).sort((a,b)=>a[0]-b[0]);
  const mA=pts.length?pts[0][1]:m,mB=pts.length?pts[pts.length-1][1]:m,s=Math.abs(mA-mB)<1e-9?0:(m-mB)/(mA-mB);
  return m+x.t*(end[1]+s*(end[0]-end[1])-m);
}
function shareAt(q,R,pct){
  const x=pctPos(pct);if(!x.t||!R||!R.shares||!(q>0))return 1;
  const end=endPair(x.k<0?R.shares.low:R.shares.high);if(!end)return 1;
  const rungs=(R.rungs||[]).map(Number).filter(v=>v>0).sort((a,b)=>a-b);if(!rungs.length)return 1;
  const a=rungs[0],b=rungs[rungs.length-1],u=q<=a||b<=a?0:q>=b?1:Math.log(q/a)/Math.log(b/a);
  return 1+x.t*(end[0]+(end[1]-end[0])*u-1);
}
function driftWalk(sizes,C,P,pct){
  const R=P.tierRule||{}, to=P.LADDER.round.to, up=v=>Math.ceil(v/to-1e-9)*to, down=v=>Math.floor(v/to+1e-9)*to;
  const cx=+R.ceilingX>0?+R.ceilingX:3;
  const k=pctPos(pct).k;
  let rS=Infinity, rP=Infinity, mS=-Infinity, mP=-Infinity;
  return sizes.map(q=>{
    const fl=floorTotal(q,C,P), ceil=+(cx*fl).toFixed(4), lo=up(fl), hi=Math.max(down(ceil),lo), m=setMultiple(q,R);
    /* top is the floor times the multiple at this %: on his ends the engine's driftMultiple, else fl*m*(1+k) in that order, as it always was */
    const step=(r,mg,top)=>{
      const rate=Math.min(r,top/q);
      let p=down(rate*q);
      if(mg>-Infinity)p=Math.max(p,up(+(fl+mg).toFixed(2)));
      const capped=p>hi+1e-9;
      p=Math.min(Math.max(p,lo),hi);
      /* where the Ceiling holds the price, the running rate follows it down to the Ceiling's own, so the next size is held to it: the
         Ceiling's rate rises with the Floor's round-up (3 times a step), and without this a high % could be quoted more a unit on more units */
      return {rate:capped?Math.min(rate,hi/q):rate,p:p,mg:Math.max(mg,p-fl)};
    };
    const s=step(rS,mS,fl*m*1);rS=s.rate;mS=s.mg;
    let p=s.p;
    if(Math.abs(k)>1e-9){const x=step(rP,mP,R.ends?fl*driftMultiple(q,R,k):fl*m*(1+k));rP=x.rate;mP=x.mg;p=x.p;}
    return {q:q,floor:+fl.toFixed(2),ceiling:+ceil.toFixed(2),set:s.p,p:p,d:k};
  });
}
/* ============ 05 OCT 2026, HIS DECISION: ANY QUANTITY AT AN AUTOMATIC PRICE ============
   A book's TIER_RULE may carry `grid`, {min, step, max}: every size from min to max in steps of step is a quantity a
   customer may type on the Counter and be quoted at once. Above max the only way in is Negotiate. The grid is read
   here and nowhere else: gridOf checks it, gridSizes lists it, onGrid says whether a size is one of its points. */
function gridOf(R){
  const G=R&&R.grid;if(!G||typeof G!=='object')return null;
  const min=+G.min,step=+G.step,max=+G.max;
  if(!(min>0)||!(step>0)||!(max>=min)||!isFinite(max))return null;
  /* 27 Oct 2026, HIS WORD ON PrEP: `multiples` narrows the grid to sizes that are a whole number of any one of them (12 or 30
     pills, N times either). The grid still runs min to max in steps so every point is priced and p[i] stays at min+i*step;
     only the sizes a customer may ORDER are cut (mulOk), by the Worker, the page and onGrid. */
  const mul=Array.isArray(G.multiples)?G.multiples.map(Number).filter(x=>x>0&&isFinite(x)):[];
  return mul.length?{min:min,step:step,max:max,multiples:mul}:{min:min,step:step,max:max};
}
function mulOk(q,G){return !G||!G.multiples||G.multiples.some(m=>Math.abs(q/m-Math.round(q/m))<1e-6);}
function gridSizes(G){
  if(!G)return [];
  const n=Math.round((G.max-G.min)/G.step),out=[];
  for(let i=0;i<=n;i++)out.push(+(G.min+i*G.step).toFixed(6));
  return out;
}
function onGrid(q,G){
  if(!G||typeof q!=='number'||!(q>0))return false;
  const k=(q-G.min)/G.step;
  return q>=G.min-1e-9&&q<=G.max+1e-9&&Math.abs(k-Math.round(k))<1e-6&&mulOk(q,G);
}
/* the sizes a drift walk takes up to and including the largest asked for: the rungs and every grid point beneath it, with
   the sizes asked for, smallest first and each once. HIS DECISION: THE WHOLE GRID IS WALKED, so the rate per unit never
   rises from one grid point to the next, and a rung reads what the walk through every point beneath it leaves. */
function walkSizes(R,sizes){
  const top=Math.max.apply(null,sizes.map(Number).concat([0]));
  const all=(R.rungs||[]).map(Number).concat(gridSizes(gridOf(R))).filter(x=>x<=top+0.009).concat(sizes.map(Number)).sort((a,b)=>a-b);
  const out=[];all.forEach(x=>{if(!out.length||Math.abs(out[out.length-1]-x)>=0.009)out.push(x);});
  return out;
}
/* the drift price at ANY size, walked against every rung and grid point beneath it (walkSizes), as fiveTierAt walks a rung */
function driftAt(q,C,P,d){
  const R=P.tierRule;if(!R||!R.drift||!(q>0))return null;
  const sizes=walkSizes(R,[q]).filter(r=>r<q-0.009).concat([q]);
  const w=driftWalk(sizes,C,P,d);return w[w.length-1];
}
/* THE AUTOMATIC DRIFT, from a customer's record (his decision of 05 Oct 2026). 18 OCT 2026: IT PRICES NOTHING NOW. The card reads
   its good and bad, and the figure that prices is the % lift he holds or nought. The caller reads the record off the book with
   the desk's own readers (buyerProfile, payDelays, lateOffer, txWrittenOff) and hands the signals in; A is the rule's
   weights. Good, 0 to 1: paid on time (a share of settlements within the term, read only from A.minSettled of them), how
   often, how much, and how many orders, nought when the last is over A.staleDays old. Bad, 0 to 1: the late flag (a half,
   or all of it when the late is a long one), anything written off, and the oldest open overdue over A.overdueDays. The
   drift is A.U times bad less A.D times good times what bad leaves, held within A.cap either way: a late payer is priced up,
   a good record down. */
function autoDrift(s,A){
  const a=A||{}, c1=v=>Math.min(1,Math.max(0,+v||0)), n=(k,v)=>a[k]!=null?+a[k]:v;
  const x=s||{};
  const P=(+x.settled||0)>=n('minSettled',3)?c1((+x.onTime||0)/(+x.settled)):0;
  const Fq=c1((+x.perMonth||0)/n('perMonth',4)), V=c1((+x.unitsPerMonth||0)/n('unitsPerMonth',10));
  const T=(x.sinceLastDays!=null&&+x.sinceLastDays>n('staleDays',60))?0:c1((+x.orders||0)/n('orders',12));
  const G=n('wP',0.35)*P+n('wF',0.25)*Fq+n('wV',0.2)*V+n('wT',0.2)*T;
  const B=Math.max(x.late?(x.lateLong?1:0.5):0,(+x.writtenOff||0)>0.009?1:0,c1((+x.overdueDays||0)/n('overdueDays',14)));
  const cap=n('cap',0.5), d=Math.min(cap,Math.max(-cap,n('U',0.5)*B-n('D',0.5)*G*(1-B)));
  const r4=v=>+v.toFixed(4);
  return {d:r4(d),G:r4(G),B:r4(B),P:r4(P),Fq:r4(Fq),V:r4(V),T:r4(T)};
}
/* ============ 18 OCT 2026, HIS DECISION: THE ENGINE SUGGESTS A % LIFT AND NEVER SETS ONE ============
   sig is driftSignals (late, lateLong, writtenOff, overdueDays, settled); ratios are the rate each of the customer's recent salt sales
   paid over the Set Price rate at that sale's size, oldest first; S is the rule's suggest block. paidOver is the median of the last
   S.recent ratios less one, nought if below; risk is S.writtenOff for anything written off, else S.longLate for a long late or an open
   overdue past S.overdueDays, else S.late for a late; 21 OCT 2026, HIS DECISION: A GOOD RECORD EARNS A DISCOUNT, good, S.good (0.3) times the
   record's good score (autoDrift's G over A, the rule's auto weights), taken off only while its bad (B) is nought: nothing late, overdue or
   written off. The suggestion is paidOver plus risk less good to the nearest S.step, held LIFT_MIN to LIFT_MAX, and nought for a customer
   with fewer than S.minSettled settled rows. Returns {pct, paidOver, risk, good}. Prices nothing: the desk and Counter Admin show it, and
   his tap sets it (a tierset), like any figure of his. */
function suggestPct(sig,ratios,S,A){
  const s=S||{}, x=sig||{}, n=(k,v)=>s[k]!=null?+s[k]:v;
  if((+x.settled||0)<n('minSettled',3))return {pct:0,paidOver:0,risk:0,good:0};
  const rs=(ratios||[]).filter(v=>typeof v==='number'&&isFinite(v)&&v>0).slice(-n('recent',5)).sort((a,b)=>a-b);
  const med=rs.length?(rs.length%2?rs[(rs.length-1)/2]:(rs[rs.length/2-1]+rs[rs.length/2])/2):1;
  const paidOver=Math.max(0,med-1);
  const risk=(+x.writtenOff||0)>0.009?n('writtenOff',0.3):(x.lateLong||(+x.overdueDays||0)>n('overdueDays',14))?n('longLate',0.2):x.late?n('late',0.1):0;
  const rec=autoDrift(x,A), good=rec.B>0?0:+(n('good',0.3)*rec.G).toFixed(4);
  const step=n('step',0.05), pct=Math.min(LIFT_MAX,Math.max(LIFT_MIN,Math.round((paidOver+risk-good)/step+1e-9)*step));
  return {pct:+pct.toFixed(2)||0,paidOver:+paidOver.toFixed(4),risk:risk,good:good};
}
/* THE SUGGESTION'S REASON, in a few words, from what suggestPct returned: 'paid 10% over', 'written off', 'paid very late', 'paid late', or
   'good record' (21 Oct 2026, a discount earned), joined by a comma.
   The one place the words are made: the Desk's card and Counter Admin's Their % form both show it. It names no one and no margin. */
function suggestWhy(sg){
  const w=[],x=sg||{};
  if((+x.paidOver||0)>=0.0249)w.push('paid '+Math.round(x.paidOver*100)+'% over');
  if((+x.risk||0)>=0.3)w.push('written off');else if((+x.risk||0)>=0.2)w.push('paid very late');else if((+x.risk||0)>0)w.push('paid late');
  else if((+x.good||0)>=0.025)w.push('good record');
  return w;
}
/* A card is the board's own price for the size, the same function for a stated board and the Set Price: what a customer paid before
   never lowers it (the cap was retired on 27 Sep 2026), and the floor still lifts it, to the first ten above, the only thing that can
   move a card off its board. R and fixed stay in the signature so no caller breaks, and nothing here reads them. */
function cardPrice(R,F,T,fixed){
  return (T!=null&&T<F-0.009)?Math.ceil((F-0.009)/10)*10:T;
}
/* v652: THE BOARD AT ANY SIZE. The rungs with the size among them, walked as fiveTiers walks them, and that size's row: at a
   rung it is the ladder's own row, and between rungs the rate law has walked every smaller size first. */
function fiveTierAt(q,C,P){
  const R=P.tierRule;if(!R||!(q>0))return null;
  const sizes=R.rungs.map(Number).filter(r=>Math.abs(r-q)>0.009).concat([q]).sort((a,b)=>a-b);
  return (fiveTiers(sizes,C,P)||[]).find(r=>Math.abs(r.q-q)<0.009);
}
/* ============ 05 OCT 2026, HIS DECISION: A NAMED CUSTOMER'S PRICE AT ANY SIZE, ONE RULE ============
   What the desk's cardQuote answered on a drift book and a stated board, moved here so the desk, the Counter's sealed
   grid and the desk Worker's card read one function. A stated board: the size's own row, pro rata on its rung's rate and
   rounded down, between the floor and the ceiling, the same for everybody. A drift book: the Set Price moved by the
   customer's drift d, walked through every grid point beneath the size. Either way never under the floor, through the
   one cardPrice. A book with neither a drift nor a board is not this function's: null. */
/* A STATED BOARD OVER ITS GRID (06 Oct 2026, his rule that the rate never rises across the grid). A size between rungs is
   its rung's rate times the size, rounded down to the ringgit: down to the book's ten, oil's rate rose within a band (13 unit
   RM160, 14 unit RM180), and walking that flat pushed the band under his next typed rung. The floor's ten and the ceiling
   hold it as fiveTiers holds a rung, and a typed rung is his price, never moved. A rate that still rises (a floor lift) steps
   down to the ringgit that holds it, never under the floor's ten. */
function fixedWalk(sizes,C,P,d){
  const R=P.tierRule, to=P.LADDER.round.to, up=v=>Math.ceil(v/to-1e-9)*to, down=v=>Math.floor(v/to+1e-9)*to;
  const rungs=R.rungs.map(Number).sort((a,b)=>a-b);
  const k=R.pct&&typeof d==='number'?pctPos(d).k:0;
  let prev=Infinity, prevD=Infinity;
  return fiveTiers(sizes,C,P).map(r=>{
    let p=r.prices&&r.prices.length?r.prices[r.prices.length-1]:null;
    const typed=R.fixed[String(r.q)]!=null, base=+R.fixed[String(rungs[r.rung])], lift=up(r.floor);
    if(!typed&&p!=null&&base>0&&rungs[r.rung]>0){
      p=Math.floor(base*r.q/rungs[r.rung]+1e-9);
      if(p<r.floor-0.009)p=lift;
      if(r.ceiling!=null&&p>r.ceiling+0.009)p=r.ceiling;
      if(prev<Infinity&&p/r.q>prev+1e-9){const st=Math.floor(prev*r.q+1e-9);p=st>=lift-0.009?st:Math.min(p,lift);}
    }
    if(p!=null&&isFinite(p)&&r.q>0)prev=Math.min(prev,p/r.q);
    /* 22 Oct 2026: Their % on a stated board, his share of the board at this size, down to the book's step, held between the Floor and
       the Ceiling, and walked so the rate never rises with size, as the board's own is */
    if(k&&p!=null&&isFinite(p)&&r.q>0){
      let x=down(p*shareAt(r.q,R,k)), lo=up(r.floor);
      if(x<lo)x=lo;
      if(r.ceiling!=null&&x>r.ceiling+0.009)x=Math.max(lo,down(r.ceiling));
      if(prevD<Infinity&&x/r.q>prevD+1e-9)x=Math.max(lo,Math.min(x,down(prevD*r.q)));
      prevD=Math.min(prevD,x/r.q);p=x;
    }
    return {q:r.q,p:p};
  });
}
/* 06 OCT 2026, HIS DECISION: A PARTNER PAYS THE FLOOR. d is 'partner' for a party the book names in `partners`, and the price at
   every size on every book is floorTotal itself: COGS times the size, no profit, and (18 Oct 2026) up to the next RM 5 like
   the Floor everyone is held to. It is NOT recomputed anywhere else, so it equals floorTotal, the snapshot's floors and the
   drafter's floor at every size. */
function quoteAt(q,C,P,d){
  const R=P.tierRule;if(!R||!(q>0))return null;
  const F=floorTotal(q,C,P);
  if(d==='partner')return +F.toFixed(2);
  if(R.fixed){const w=fixedWalk(walkSizes(R,[q]),C,P,d),x=w.find(r=>Math.abs(r.q-q)<0.009),t=x?x.p:null;
    return t==null||!isFinite(t)?null:+cardPrice(null,F,t,true).toFixed(2);}
  if(R.drift){const x=driftAt(q,C,P,d);return x&&isFinite(x.p)?+cardPrice(null,F,x.p).toFixed(2):null;}
  return null;
}
/* THE GRID A CUSTOMER'S LIST CARRIES: quoteAt at every point of the book's grid, {min, step, max, p}, one walk a book, so
   p[i] is exactly quoteAt(min + i*step). Null for a book with no grid, or one any point of which is unpriced. */
function quoteGrid(C,P,d){
  const R=P.tierRule,G=gridOf(R);if(!G)return null;
  const qs=gridSizes(G);let ps;
  const read=(w,fixed)=>qs.map(q=>{const x=w.find(r=>Math.abs(r.q-q)<0.009);return x&&x.p!=null&&isFinite(x.p)?+cardPrice(null,floorTotal(q,C,P),x.p,fixed).toFixed(2):null;});
  if(d==='partner')ps=qs.map(q=>quoteAt(q,C,P,d));
  else if(R.drift)ps=read(driftWalk(walkSizes(R,qs),C,P,d),false);
  else if(R.fixed)ps=read(fixedWalk(walkSizes(R,qs),C,P,d),true);
  else ps=qs.map(q=>quoteAt(q,C,P,d));
  if(!ps.length||ps.some(p=>p==null||!isFinite(p)||!(p>0)))return null;
  return G.multiples?{min:G.min,step:G.step,max:G.max,p:ps,multiples:G.multiples}:{min:G.min,step:G.step,max:G.max,p:ps};
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

/* THEIR CARD AT A SIZE, READ OFF THE PRICING SNAPSHOT (tools/book.mjs pricingSnapshot): the desk's own cardQuote, carried and never
   worked out; a size off the board is quoteAt on the snapshot's own inputs and their lift, which their sealed grid was struck from.
   Moved here from src/orders.js on 20 Oct 2026 so the drafter's stamp of their price (listRM) and the fold's re-stamp on an amendment
   read the one copy the Worker reads. */
function cardAt(pricing,code,product,qty){
  const snap=pricing&&pricing.byProduct&&pricing.byProduct[product];
  if(!snap||!snap.cards)return {card:null,cardNote:"the pricing snapshot carries no cards yet: the next re-seed brings them"};
  const hit=(snap.cards[code]||[]).find(x=>Math.abs(x[0]-qty)<0.009);
  /* 22 Oct 2026, his word: every customer is separate, so the note names their price and never describes it */
  if(hit)return {card:hit[1],cardNote:"their price at "+qty+" unit"};
  if(!snap.cards[code])return {card:null,cardNote:"no tier is held or proposed for them on "+product+", so there is no card"};
  const at=quoteOff(snap,code,qty);
  if(at!=null)return {card:at,cardNote:"their price at "+qty+" unit"};
  return {card:null,cardNote:qty+" unit is not a size on their board, so there is no card at it"};
}
function quoteOff(snap,code,qty){
  const I=snap&&snap.inputs;
  if(!I||!I.cost||!I.policy||!(qty>0))return null;
  const R=I.policy.tierRule||null;
  const held=snap.lift&&typeof snap.lift[code]==="number"?snap.lift[code]:null;
  const d=(snap.partners||[]).includes(code)?"partner":R&&R.drift?held:R&&R.pct&&held!=null?held:0;
  if(d==null)return null;
  try{const v=quoteAt(qty,costStack(I.cost),I.policy,d);return v!=null&&isFinite(v)&&v>0?v:null;}
  catch(e){return null;}
}

return {cardAt:cardAt,costStack:costStack,buyTaper:buyTaper,ladderMarkup:ladderMarkup,ladderMargin:ladderMargin,ladderCogs:ladderCogs,
        ladderRound:ladderRound,ladderWalk:ladderWalk,ladderAsk:ladderAsk,lotCost:lotCost,
        floorTotal:floorTotal,costTotal:costTotal,priceLadder:priceLadder,ladderRow:ladderRow,board:board,fiveTiers:fiveTiers,fiveTierAt:fiveTierAt,cardPrice:cardPrice,
        setMultiple:setMultiple,driftOk:driftOk,pctBook:pctBook,driftMultiple:driftMultiple,shareAt:shareAt,LIFT_MIN:LIFT_MIN,LIFT_MAX:LIFT_MAX,driftWalk:driftWalk,driftAt:driftAt,autoDrift:autoDrift,suggestPct:suggestPct,suggestWhy:suggestWhy,
        gridOf:gridOf,gridSizes:gridSizes,onGrid:onGrid,walkSizes:walkSizes,fixedWalk:fixedWalk,quoteAt:quoteAt,quoteGrid:quoteGrid};
})();
export default PRICING_ENGINE;
