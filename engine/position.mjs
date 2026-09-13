/* engine/position.mjs: THE POSITION ENGINE, OUT OF THE DESK (move 1 of the rebuild, session 2, 22 Aug 2026).
 *
 * ONE DEFINITION of the transaction model and the ledger walk. The row helpers (what a row has
 * paid, delivered, deferred, pending, its state and its dates; what a lot has received and paid;
 * the ageing ladder) are the desk's own text, lifted verbatim. The walk is recompute() with the
 * globals it set turned into the fields of a record, and the facts it read turned into an input
 * record the desk gathers in posInputs(). Cover, the commitments and the phone's row shape follow.
 *
 * The desk keeps every name as a one-line wrapper, so its hundreds of call sites are untouched.
 * Inlined into master/salt_command.html by `node tools/engine.mjs --sync`; CI proves the copy is
 * this file. See engine/pricing.mjs for the rules of the shape, which are the same here. */
const POSITION_ENGINE=(function(){
/* ---- the row helpers, verbatim from the desk ---- */
function txPrice(s){return s.qty>0?s.total/s.qty:0;}
function txPaid(s){return (s.cash||0)+(s.settledRM||0);}
/* v502: the goods half of a sale's total, its delivery charge taken out; the rate a unit was
   sold at is this over the quantity, never the total over it. */
function txGoods(s){return +(s.total||0)-(+s.delivery||0);}
function txDeliv(s){return (s.deliveredQty||0)+(s.settledKg||0);}
/* ====== COST IS ABSOLUTE (v496, his instruction of 05 Sep 2026) ================
   A sale's `cost` is the cost of the order in RM, stored as a person states it, and the cost
   of a movement is stored on the step that moved it, `amend[i].cost`, also in RM. Until v496
   `cost` was RM per unit, and every reader multiplied it by a quantity of its own choosing:
   qty here, units moved there, and the audit of 04 Sep found COGS defined three ways. The
   unit cost is DERIVED here, once, and nothing else divides. `fallback` is what a row with
   no stated cost is costed at, the caller's shelf figure, so the fallback stays the caller's
   and the derivation stays here. A row with no quantity has no unit cost. */
function txCost(s){return s.cost!=null?+s.cost:null;}
function txUnitCost(s,fallback){return (s.cost!=null&&s.qty>0)?+s.cost/s.qty:(fallback==null?null:fallback);}
function txPhys(s){return (s.deliveredQty||0);}
function txEffDeliv(s){return txDeliv(s)+(s.advanceUnits||0);}
function txAdvance(s){return Math.max(0,(s.deliveredQty||0)*txPrice(s)-txPaid(s));}
/* A CANCELLED ORDER OWES NO SALT. txPendUnits, txPendUnitsRaw and txPendRM, the three lines
   directly below, have opened with this guard since they were written; this one never did, and
   it is the one that turns MONEY into a claim on the shelf. txDeferUnits asks how much salt has
   been paid for and not yet handed over, so on a cancelled order paid in full it answered the
   whole quantity: the desk then told the owner it owed CY2-NIL 2.5 unit while txStat on the
   SAME ROW said `Refund due`. Two contradictory claims on one row, and the more expensive one
   drove a purchase: the Buy action read `2.75 unit short on promises` against a true 0.25.
   THE PURCHASE SIDE TOOK THIS EXACT SHAPE FIRST: poRecvUnits at v417 and poOpenUnits at v422,
   with poCash deliberately left unguarded because money that left the bank still left it. This
   is the sale-side mirror, and txPaid stays unguarded for the same reason: the cash is real, it
   is simply a refund due rather than salt owed. */
function txDeferUnits(s){if(s.cancelled)return 0;const p=txPrice(s);if(!(p>0))return 0;return Math.max(0,txPaid(s)/p-txEffDeliv(s));}
function txPendUnits(s){if(s.cancelled)return 0;return Math.max(0,+(s.qty-txEffDeliv(s)-txDeferUnits(s)).toFixed(2));}
function txPendUnitsRaw(s){if(s.cancelled)return 0;return Math.max(0,s.qty-txEffDeliv(s)-txDeferUnits(s));}
function txPendRM(s){if(s.cancelled)return 0;const p=txPrice(s);if(!(p>0))return 0;return +(Math.max(0,s.qty-txEffDeliv(s)-txDeferUnits(s))*p).toFixed(2);}
function txStat(t){
  /* THE SAME MONEY, SETTLED TWO WAYS, MUST READ THE SAME WAY. This branch measured a cancelled
     row's money as t.cash alone, while the line DIRECTLY BENEATH IT has read cash plus settledRM
     for every other row since the settlement-in-kind fields existed, and txPaid is the one rule
     for it. So a cancelled order the customer had settled in kind reported `Unpaid`, which says
     the business owes nothing, when it holds RM 100 of that customer's value and owes it back.
     Cash said `Refund due` on the identical figure.
     `deliv` STAYS HARDCODED and that is deliberate rather than an oversight: v434 refuses to
     record a movement against a cancelled row and v436 refuses to cancel a row that has moved, so
     a cancelled row carrying delivery cannot be written any more, and no row on the book has one.
     If those guards ever come off, this is the line that goes with them. */
  if(t.cancelled)return {order:'Cancelled',cls:'def',pay:txPaid(t)>0.009?'Refund due':'Unpaid',deliv:'Undelivered'};
  const paid=(t.cash||0)+(t.settledRM||0), del=(t.deliveredQty||0)+(t.settledKg||0);
  /* A ZERO-VALUE ROW IS PAID IN FULL BY DEFINITION. payFull required total>0, so the
     first free unit ever handed over read as Open - Advance: salt out, nothing in,
     therefore money owed. Nothing was owed. There is no price to meet, so the test is
     met. Without this a rebate redemption sits on the books for ever as a debt.
     v345: AND A ZERO IS NOT ALWAYS THAT ZERO. An order can be agreed before its price is
     struck, and the rule above would read it as settled in full: Pending, Paid, nothing
     owed, on a row where the whole point is that the figure is not decided. `unpriced` says
     which of the two a zero is. It can never be paid, because there is nothing yet to pay,
     so payFull is false and the label says so. Everything downstream then behaves: undated
     with nothing moved it is Pending and counts nowhere, and if goods go out before a price
     is agreed it becomes Open - Advance, which is exactly what that would be. */
  const payFull=t.unpriced?false:(t.total<=0.009?true:(paid>=t.total-0.009)), payNone=paid<=0.009, delFull=t.qty>0&&del>=t.qty-0.009, delNone=del<=0.009;
  const pay=t.unpriced?'Unpriced':payFull?'Paid':payNone?'Unpaid':'Partial';
  const deliv=delFull?'Delivered':delNone?'Undelivered':'Partial';
  let order=(payFull&&delFull)?'Completed':(payNone&&delNone)?'Pending':'Open';
  if(order==='Open'){                                                  // split Open the same way the replay does
    const paidFrac=t.total>0?paid/t.total:0,delivFrac=t.qty>0?del/t.qty:0;
    if(delivFrac>paidFrac+1e-9)order='Open · Advance';                 // delivered ahead, they owe cash
    else if(paidFrac>delivFrac+1e-9)order='Open · Deferred';           // paid ahead, you owe salt
  }
  let cls=order==='Completed'?'paid':order==='Pending'?'pendingt':'open';
  if((t.settle==='barter'||t.waived||t.rebate)&&payFull&&delFull){order='In-Kind';cls='inkind';}
  /* A DEFAULTED SALE READS Default, AS A DEFAULTED LOT HAS SINCE poStat WAS WRITTEN (05 Sep 2026).
     The flag was set on s117 on 2 Sep and this function never read it, so the row stayed
     Open . Advance, the Ledger's Default filter could match nothing, and the Approve card
     painted a debt he had written off in the design system's word for settled. pay and deliv
     are left as computed, because they are still true: unpaid, and delivered. Only the order
     word and its class change. It sits AFTER cancelled, which returns above and wins, and after
     In-Kind, which cannot coincide with it because In-Kind requires payFull. */
  if(t.defaulted){order='Default';cls='def';}
  return {order,cls,pay,deliv};
}
function txDates(s){
  const am=s.amend||[];
  const unitSteps=am.filter(a=>a.kind==='Fulfilment'&&+a.kg>0.0001);
  const cashSteps=am.filter(a=>+a.cash>0.0001);
  const phys=txPhys(s), eff=txEffDeliv(s), paid=txPaid(s);
  const full=s.qty>0&&eff>=s.qty-0.01, fullPaid=s.total>0&&paid>=s.total-0.01;
  let dOn=null,dSrc=null,pOn=null,pSrc=null;
  if(s.cancelled){return {dOn:null,dSrc:'cancelled',pOn:null,pSrc:'cancelled',full:false,fullPaid:false};}
  if(eff>0.0001){
    if(!full){dSrc='partial';}
    else if(unitSteps.length){dOn=unitSteps[unitSteps.length-1].date||s.date;dSrc='trail';}
    else if(s.deliveredOn){dOn=s.deliveredOn;dSrc='stated';}
    else if(phys>0.0001||eff>0.0001){dOn=s.date;dSrc='assumed';}
  }else{dSrc='undelivered';}
  if(paid>0.0001){
    if(!fullPaid){pSrc='partial';}
    else if(cashSteps.length){pOn=cashSteps[cashSteps.length-1].date||s.date;pSrc='trail';}
    else if(s.paidOn){pOn=s.paidOn;pSrc='stated';}
    else{pOn=s.date;pSrc='assumed';}
  }else{pSrc='unpaid';}
  return {dOn,dSrc,pOn,pSrc,full,fullPaid};
}
function poRecvUnits(p){
  /* v417: A CANCELLED LOT IS NOT A LOT. Nothing here tested it, so a cancelled purchase kept its
     units in stock, its cost in the basis and its quantity in "still to arrive", while the control
     that cancelled it promised in its own hint that the row leaves every figure on the desk. The
     cancellation gate only lets a lot be cancelled when nothing has arrived, so on today's book
     this changes no figure; it is the state the gate ADMITS that this closes. */
  if(p.cancelled)return 0;
  if(p.defaulted)return 0;
  /* a PENDING lot is agreed and nothing more: no money has moved and no salt has landed,
     so it must not be read as received. Without this it defaults to fully received and
     silently walks into stock, the cost basis and therefore every margin on the desk. */
  if(p.pending)return 0;
  if(p.receivedQty!=null)return Math.max(0,Math.min(+p.receivedQty,p.qty));
  return p.inTransit?0:p.qty;
}
/* v417: DELIBERATELY NO CANCELLED TEST, and this is the one of the four that must not have one.
   Money that left the bank still left it: the desk already states that rule beside outRM, "a
   defaulted lot was still paid for". A cancelled lot that was paid for is a REFUND DUE from the
   supplier, which is what the sale side calls it, and zeroing the payment here would erase the
   fact rather than record the claim. What a cancelled lot must not do is look like an unpaid
   BILL, and billsOut is where that is handled. */
function poCash(p){
  if(p.pending)return 0;                       // agreed only: no money has moved
  if(p.cash!=null)return +p.cash;              // an explicit figure always wins
  return p.status==='paid'?+p.total:0;         // only a row that SAYS paid is assumed paid
}
function poLive(p){return !p.pending&&!p.defaulted&&!p.cancelled;}   /* v417 */
/* ====== WHAT A LOT IS (v446) ====================================================
   txStat has been in this module since v338 and ledgerBuy stayed on the desk, and that
   split IS the reason the pair drifted. v441 gave the SALE's cancelled branch a paid figure
   it measures rather than asserts; the lot half of the identical question was in another
   file three thousand lines away and got nothing. So the lot's status comes here, beside the
   sale's, and the desk's ledgerBuy becomes the one-line wrapper txStat already was.
   WHAT IT WAS GETTING WRONG. Both found by driving states this book can hold, not by reading:
     CANCELLED: there was no branch at all. poCash is deliberately unguarded, because money
     that left the bank has left it, so a cancelled lot already paid for read Paid and
     Undelivered and fell through to `Open - Deferred`, which on a purchase says the supplier
     owes you SALT on an order that is off. The supplier owes you the MONEY. Same fault, same
     shape and now the same words as v441 on the sale. Three sites in the Ledger's own card
     render already test for si.order==='Cancelled' -- ledFinal, `completed`, stateCls -- so
     the render has been ready for an answer the status function could never give.
     UNPRICED: `paid>=total-0.009` on a total of nothing is `0>=-0.009`, which is true, so a
     lot agreed before its price was struck read Paid, and once the salt landed it read
     Completed: settled, nothing owed, on a row whose whole point is that the figure is not
     decided. txStat has answered `Unpriced` here since v345. Only the two pay predicates
     move; every label a priced lot has ever shown is the same expression it was.
   `deliv` IS HARDCODED ON BOTH TERMINAL BRANCHES, deliberately, and on the same footing as
   txStat's: applyAmend refuses to cancel a lot that has received (v415 picks the ruler by
   direction) and correctionFaults refuses cancelled-and-moved on either side (v436), so a
   cancelled lot carrying delivery cannot be written. If those guards come off, this goes
   with them.
   AND `pay` ON THE DEFAULT BRANCH IS MEASURED NOW, not asserted. It read a flat 'Paid',
   which is the exact shape v441 had to undo on the sale: true of the one defaulted lot on
   the book, and false the moment someone sets the flag on a lot that never paid. */
function poStat(p){
  const paid=poCash(p);
  if(p.defaulted)return {order:'Default',cls:'def',pay:paid>0.009?'Paid':'Unpaid',deliv:'Undelivered'};
  if(p.cancelled)return {order:'Cancelled',cls:'def',pay:paid>0.009?'Refund due':'Unpaid',deliv:'Undelivered'};
  const payFull=p.unpriced?false:paid>=p.total-0.009, payNone=paid<=0.009;
  const pay=p.unpriced?'Unpriced':payFull?'Paid':payNone?'Unpaid':'Partial';
  const r=poRecvUnits(p);
  const deliv=r<=0.0001?'Undelivered':(r>=p.qty-0.0001?'Delivered':'Partial');
  const order=(payFull&&deliv==='Delivered')?'Completed':(payNone&&deliv==='Undelivered')?'Pending':(deliv==='Delivered'?'Open · Advance':'Open · Deferred');
  return {order,cls:order==='Completed'?'paid':/^Open/.test(order)?'open':'pendingt',pay,deliv};
}
function poRate(p){return p.qty>0?p.total/p.qty:0;}
/* ====== WHAT A LOT STILL OWES ITS SUPPLIER (v438) ===============================
   FIVE readers answered this and each excluded a DIFFERENT subset of {pending, cancelled,
   defaulted}, so the desk could tell the owner three different figures for one question:
     billsOut          pending, cancelled          (not defaulted)
     supBills, sCash   pending, defaulted          (not cancelled), and read p.cash raw
     the forecast      pending                     (neither of the others)
     lots in transit   poLive                      (the only one that was right)
   On the book as it stands all of them read RM 0, which is why nothing had shown: the
   divergence is latent, and a latent divergence in a payable is what put five settled lots and
   RM 5,450 in front of the owner at v408. poLive is already the rule for whether a lot is live;
   what it owes is that rule and a subtraction, and it lives here now.
   THE FLOOR AT ZERO IS PART OF THE RULE. supBills and sCash had no Math.max, so an overpaid lot
   subtracted from what the other lots owed and quietly reduced the total. */
function poOwed(p){return poLive(p)?Math.max(0,+(+p.total-poCash(p)).toFixed(2)):0;}
/* v417: without the cancelled test this returned the WHOLE quantity as still to arrive, because
   poRecvUnits reads nothing received and the subtraction then has nothing to take away.
   v422: AND A DEFAULTED LOT IS NOT STILL TO ARRIVE EITHER, for the same arithmetic and a plainer
   reason: the supplier took the money and sent nothing, which is the definition of the flag. Every
   caller in the desk already filtered defaulted by hand, so no total moves; what changes is that
   a reader who does NOT filter, such as the update panel, is no longer told 12.5 unit is coming. */
function poOpenUnits(p){return (p.cancelled||p.defaulted)?0:+(p.qty-poRecvUnits(p)).toFixed(4);}
function provRate(days){return days>=21?1:days>=14?0.75:days>=8?0.5:days>=4?0.25:0;}
/* A DECLARED DEFAULT PROVISIONS IN FULL (05 Sep 2026, his instruction: CA4-DAM's outstanding is
   defaulted, with the same treatment as SF6-KLC). The ladder measures how likely money is to come
   by how long it has been out; a default is his statement that it will not come at all, and it
   beats the ladder the way the supplier write-off beats it four lines below in the walk. This is
   the ONE reader of that fact for the sale side. Every net-of-ladder figure on the desk goes
   through it, so gross keeps the number everywhere (the record of what was traded and lost, the
   numerator of the provision, the reason pxParty penalises the party's next quote) and net goes
   to zero everywhere (what the desk expects to collect). The supplier readers keep calling
   provRate directly: that side has its own rule and its own record. */
function saleProvRate(s,days){return (s&&s.defaulted)?1:provRate(days);}
/* ============ THE WALK (was recompute) ============
   Everything the desk's tabs read about a product is set by one pass over that product's
   rows: what arrived, what left, what the shelf carries, what is owed each way, and what the
   book earned. Ported verbatim; the globals it used to set are the fields of W, and the facts
   it used to read are the fields of I:
     sales, purchases   this product's rows only, or oil sold would eat salt off the shelf
     opening            {qty, costPerKg, stated, uncounted} for the product
     isSalt             loans and the supplier receivable are salt arrangements
     loanUnits             units drawn against loans, net: lent out less borrowed in (salt only; pre-opening loans are inside the opening count; v518)
     counted            the hand count that beats the ledger, or null when this book was never counted
     supplierReceivable {amount, since, status} or null
     today              the as-of date, for ageing the receivables
     wavgBuyPrev        the weighted buying rate as it stood before this pass: goodwill is
                        valued with it, exactly as the desk always has, because that line runs
                        before the rate is recomputed */
function daysBetween(today,d){return Math.floor((today-new Date(d))/86400000+1e-9);}
/* ONE RULE FOR AN AGE, AND NOW ONE COPY OF IT (v445). The desk has had dAge since v407 and the
   engine has not, so every age computed inside the walk used the raw signed difference. Writing a
   second floor inside this module would be the drift this repo keeps folding against, so the rule
   moves HERE and the desk's dAge becomes a one-line wrapper over it.
   WHAT IT IS FOR, kept from the desk's own comment. A date ahead of the clock is either a mistyped
   row or a clock stepped back; v406 floored four surfaces and left four, so the same money read
   -16d on Today and 0d out on Forward. AND AN ABSENT DATE IS NOT A DAY COUNT (v425): dbet(undefined)
   is NaN, Math.max(0,NaN) is NaN, and NaN printed as NaNd ago and compared false against every
   threshold, so a party with an undated order fell out of the overdue tile rather than showing
   wrong. null is the trap and it is worse than undefined, because new Date(null) is the epoch and a
   finiteness test waves twenty thousand days straight through; an undated row on this book stores
   null, not undefined, so that is the case that actually occurs.
   It takes a date or a day count, because half the sites hold one and half the other. */
function dayAge(today,d){
  if(d===null||d===undefined||d==='')return 0;
  const n=(typeof d==='number')?d:daysBetween(today,d);
  return Number.isFinite(n)?Math.max(0,n):0;
}
function walk(I){
  const _S=I.sales||[], _B=I.purchases||[];
  const today=(I.today instanceof Date)?I.today:new Date(I.today);
  const dbet=d=>daysBetween(today,d);          /* SIGNED: for a countdown to a future date */
  const dage=d=>dayAge(today,d);               /* FLOORED: for how long ago, which is what a ladder eats */
  const W={};
  W.receivedPO=_B.filter(p=>!p.defaulted&&poRecvUnits(p)>0.0001);
  W.defaultPO=_B.filter(p=>p.defaulted);
  /* v280, HIS RULING: goodwill is an EXPENSE, not a sale. The row stays in sales so the salt it
     moved still leaves the shelf; it is only kept out of the priced set. */
  W.pricedSales=_S.filter(s=>{const o=txStat(s).order;return o!=='Pending'&&o!=='Cancelled'&&!s.goodwill;});
  W.goodwillRM=+_S.filter(s=>s.goodwill).reduce((a,s)=>a+(s.qty||0)*txUnitCost(s,I.wavgBuyPrev),0).toFixed(2);
  /* the cost basis follows the units ACTUALLY ON THE SHELF, valued at the rate of the lot they
     came off: a part-delivered lot enters as it lands, not whole on the first unit */
  W.buyUnits=W.receivedPO.reduce((s,p)=>s+poRecvUnits(p),0);
  W.buyRM=W.receivedPO.reduce((s,p)=>s+poRecvUnits(p)*poRate(p),0);
  const _op=I.opening||{qty:0,costPerKg:null,stated:null,uncounted:true};
  const openInCost=_op.costPerKg!=null;
  const costUnits=W.buyUnits+(openInCost?_op.qty:0);
  const costRM=W.buyRM+(openInCost?_op.qty*_op.costPerKg:0);
  W.wavgBuy=costUnits>0?costRM/costUnits:0;                 // no lots yet is not a division by nothing
  const loanUnits=I.isSalt?(+I.loanUnits||0):0;
  const drawnUnits=_S.reduce((a,s)=>a+txPhys(s),0)+loanUnits;
  W.soldUnits=drawnUnits;
  W.ledgerStock=+(_op.qty+W.buyUnits-drawnUnits).toFixed(2);
  /* A COUNT AND A ZERO ARE DIFFERENT CLAIMS: a counted shelf beats the ledger; a book never
     counted falls back to what the ledger says rather than inventing a count. */
  const _cnt=I.counted;
  W.stockCounted=_cnt!=null;
  W.currentStock=+((_cnt!=null?_cnt:W.ledgerStock)).toFixed(2);
  W.selfUse=W.stockCounted?Math.max(0,+(_op.qty+W.buyUnits-drawnUnits-W.currentStock).toFixed(2)):0;
  /* the same difference the other way: a count ABOVE the ledger is a surplus, not shrinkage,
     and flooring selfUse to zero hid it entirely (round six). The reconciliation prints it;
     nothing else reads it, so pricing and the P&L are untouched. */
  W.surplus=W.stockCounted?Math.max(0,+(W.currentStock-(_op.qty+W.buyUnits-drawnUnits)).toFixed(2)):0;
  W.revTotal=W.pricedSales.reduce((a,s)=>a+(s.total||0)-txPendRM(s),0);   // net of any pending tail on a part-moved order
  W.revCollected=_S.reduce((a,s)=>a+(s.cash||0),0);
  /* AR = advance only: pending unpaid-and-undelivered is not a receivable */
  W.arList=_S.filter(s=>txAdvance(s)>0.009);
  W.arGross=W.arList.reduce((a,s)=>a+txAdvance(s),0);
  W.ar=Math.max(0,+W.arList.reduce((a,s)=>a+txAdvance(s)*(1-saleProvRate(s,dage(s.date))),0).toFixed(2)); // net of provisioning; a declared default nets to zero
  W.advTotal=W.arGross;
  W.defUnits=+_S.reduce((a,s)=>a+txDeferUnits(s),0).toFixed(2);
  const _sr=I.isSalt?(I.supplierReceivable||null):null;
  W.supRecovGross=_sr?_sr.amount:0;
  const srDays=_sr?dage(_sr.since):0;
  W.supRecovNet=(_sr&&_sr.status==='writtenOff')?0
    :+(W.supRecovGross*(1-provRate(srDays))).toFixed(2);
  W.cogs=W.pricedSales.reduce((a,s)=>a+(s.qty-txPendUnitsRaw(s))*txUnitCost(s,W.wavgBuy),0);  // no cost against salt not yet moved
  W.grossMargin=W.revTotal-W.cogs;W.marginPct=W.revTotal>0?W.grossMargin/W.revTotal*100:0;
  return W;
}
/* ============ COVER ============ how many days the free shelf lasts at the rate actually shipped */
function coverStats(S){
  const MS=86400000, today=(S.today instanceof Date)?S.today:new Date(S.today);
  const rows=S.pricedSales||[];
  const win=n=>{const from=new Date(today.getTime()-n*MS);
    return +rows.filter(s=>new Date(s.date)>=from).reduce((a,s)=>a+txPhys(s),0).toFixed(2);};
  const units14=win(14),units28=win(28);
  const rate14=+(units14/14).toFixed(3),rate28=+(units28/28).toFixed(3);
  const rate=rate14>0?rate14:rate28;
  const free=+(S.currentStock-S.defUnits).toFixed(2),usable=Math.max(0,free);
  const days=rate>0?+(usable/rate).toFixed(1):null;
  const zero=days!=null?new Date(today.getTime()+days*MS):null;
  return {units14,units28,rate14,rate28,rate,free,days,zero,
    reorderAt:S.reorderUnits,below:free<S.reorderUnits,shortBy:+(S.reorderUnits-usable).toFixed(2)};
}
/* ============ COMMITMENTS ============ what is owed out (paid ahead of delivery) and promised
   (agreed, nothing moved), which is the part of the forecast the phone and the drafter read */
function commitments(sales,currentStock){
  const rows=sales||[];
  const defRows=rows.filter(s=>txDeferUnits(s)>0.009)
    .map(s=>({id:s.customer,kg:+txDeferUnits(s).toFixed(2),rm:0,why:'paid ahead of delivery'}));
  const pendRows=rows.filter(s=>txPendUnits(s)>0.009)
    .map(s=>({id:s.customer,kg:+txPendUnits(s).toFixed(2),rm:txPendRM(s),why:'agreed, nothing moved'}));
  const owedUnits=+defRows.reduce((a,r)=>a+r.kg,0).toFixed(2);
  const promUnits=+pendRows.reduce((a,r)=>a+r.kg,0).toFixed(2);
  const promRM=+pendRows.reduce((a,r)=>a+r.rm,0).toFixed(2);
  const commitUnits=+(owedUnits+promUnits).toFixed(2);
  return {defRows,pendRows,owedUnits,promUnits,promRM,commitUnits,
    shortUnits:+Math.max(0,commitUnits-currentStock).toFixed(2), coverable:currentStock>=commitUnits};
}
/* ============ A ROW AS THE PHONE SEES IT ============ the ledger and open-order shape of the
   payload: what was traded, what moved, what is still to be handed over each way, and a state
   word. No cost and no margin, because the phone is public. */
function ledgerRow(t,dir,defaultProd){
  const q=+t.qty||0, tot=+t.total||0;
  const buy=(dir==='B');
  const paidRM=buy?poCash(t):txPaid(t);
  const mv=buy?poRecvUnits(t):txEffDeliv(t);
  /* v460: A CANCELLED ROW OWES NOTHING, EITHER WAY. txPendRM and txPendUnits have said so since
     they were written and txDeferUnits since v443; this shape said a cancelled order still owed
     its whole total and its whole quantity, on all five cancelled sales on the book, beside a
     state that says canc. Money the customer had paid on a cancelled order is a refund, which is
     customerRefunds' shape (v444), not a negative here. */
  const oweRM=t.cancelled?0:+Math.max(0,tot-paidRM).toFixed(2);      // money still to be handed over
  const oweUnits=t.cancelled?0:+Math.max(0,q-mv).toFixed(2);          // goods still to be handed over
  let st;
  if(t.cancelled) st='canc';
  else if(!t.date||t.pending) st='pend';
  else if(oweRM<0.005&&oweUnits<0.005) st='done';
  else if(oweUnits>=0.005&&oweRM>=0.005) st='part';
  else if(oweUnits>=0.005) st=buy?'dueStock':'oweStock';
  else st=buy?'oweMoney':'dueMoney';
  const r={ d:t.date||null, p:t.customer||t.supplier||'', dir:dir,
    q:q, t:tot, cash:+paidRM.toFixed(2), mv:+mv.toFixed(2), st:st };
  if(oweRM>=0.005) r.oweRM=oweRM;
  if(oweUnits>=0.005) r.oweUnits=oweUnits;
  const pr=t.product||defaultProd;
  if(pr!==defaultProd) r.pr=pr;
  /* v362: THE ID AND THE ATTRIBUTION, so the phone can name a row and prefill an edit of it.
     Neither is a cost and neither is a margin, so neither trips the leak rule the rest of this
     shape obeys: a rid is opaque and an attribution is a code that is already on the roster the
     payload ships anyway. THE NOTE IS STILL NOT HERE, and that is the one field the phone
     editor cannot touch: the notes carry lot costs and margins in prose, and this app is
     public by decision. That is a policy line, not a size one. */
  if(t.rid) r.rid=t.rid;
  /* v364: THE RAW FIGURES, WHERE THEY DIFFER FROM THE DERIVED ONES. r.cash is txPaid and
     r.mv is txEffDeliv, which is right for READING a row (they are what the row has
     actually settled) and wrong for EDITING one: a correction writes the raw cash and
     deliveredQty fields, and on the thirteen rows carrying in-kind settlements the two
     part company. The phone's editor prefilled the derived figure into a box that writes
     the raw field, so retyping RM100 over a shown RM80 on a row whose raw cash was 0
     would have set effective paid to RM180. Emitted only where they differ, which is
     what keeps this a few bytes rather than two fields on every row. */
  if(dir!=='B'){
    if(Math.abs((t.cash||0)-paidRM)>0.005) r.cashRaw=+(t.cash||0);
    if(Math.abs((t.deliveredQty||0)-mv)>0.005) r.delivRaw=+(t.deliveredQty||0);
  }
  const at=attributionOf(t,dir==='B'?'supplier':'customer');
  if(at.assoc){ r.as=at.assoc; r.st2=at.stream; if(at.downstream) r.dn=at.downstream; }
  /* v363: EVERY REMAINING EDITABLE ATTRIBUTE, so the phone's editor can prefill a row rather
     than offering a blank box for a field that already has a value. Emitted only when present,
     which is why this costs 2 KB across 125 rows: most rows carry none of them.

     TWO ARE DELIBERATELY ABSENT AND MUST STAY ABSENT. `cost` is a per-unit cost, which is the
     one figure phonePayloadLeaks() bans outright. `note` is prose that quotes lot costs and
     margins in words, which is the same ban in a longer form. The phone therefore cannot edit
     those two, and its sheet says so rather than leaving it a mystery: it will not offer to
     replace a value it is not allowed to show you. */
  for(const k of CORRECT_DATE.concat(CORRECT_TEXT,CORRECT_BOOL,['receivedQty','settledRM','settledKg','rebate','rebateKg','goodwill'])){
    if(k==='date'||k==='note') continue;                 // date is already `d`; note never travels
    if(t[k]!=null&&t[k]!==false) r[k]=t[k];
  }
  return r;
}
function openable(r){return r.st!=='done'&&r.st!=='canc';}
/* WHO THE ASSOCIATE IS, READ BACK OUT OF A ROW. An attribution is not stored the way it is
   typed: a row has no assoc field and no stream field, and the book never carried either.
   What it carries is the desk's translation of them, and the two streams translate
   differently.

     R2  the row books TO the associate. The counterparty field holds the associate, rev is
         'R2', and the actual buyer is kept beside it as downstream. The buyer is not the
         counterparty on that row and gets no statement from it.
     R3  the row books to the BUYER as normal, and the introduction is credited beside it:
         ref holds the associate, refKg the size.

   So the associate has to be DERIVED from a row rather than read off a field, and clearing
   an R2 has to put the buyer back from downstream or the counterparty is lost outright.
   It lives here, in the engine, because three places need the same answer: the desk's
   ovAmend, the fold's applyAmend, and the phone payload below. Two of them had their own
   copy for about an hour on 25 Aug and that is exactly the drift this file exists to stop. */
/* WHAT A CORRECTION MAY SET, grouped by how each field is checked. It lives in the engine
   for the same reason attributionOf does, one line above: the drafter decides whether to
   accept a correction, the fold applies it and the desk's ovAmend applies it too, and all
   three have to agree about which fields exist and what kind each one is. A table in two
   places is a table that will differ.

   NOT HERE, and excluded rather than forgotten: rid (identity), amend and mod (the trail),
   rev/ref/refKg (derived from assoc + stream) and a purchase's status (derived from cash
   against total). Everything a person typed is editable; nothing the desk computes is. */
const CORRECT_NUM_POS=['qty'];
/* v365: rebate and goodwill are FLAGS, not amounts -- every row that carries either stores
   it as true, never a figure, and the real redemption size lives in the neighbouring
   rebateKg. Both sat here as numeric until an untouched Save on a rebate-settled phone row
   queued a boolean coerced into a blank number box back out as null, silently clearing the
   flag. Kept out of CORRECT_NUM_NN and into CORRECT_BOOL instead. */
/* v502: `delivery` is the RM of an order's total that is the delivery charge, typed per order
   (his instruction, 07 Sep 2026). It is INSIDE the total, so nothing that reads what is owed or
   paid changes; what changes is the rate, which is struck on the goods: txGoods below. */
const CORRECT_NUM_NN=['total','cash','deliveredQty','receivedQty','cost',
  'settledRM','settledKg','rebateKg','delivery',
  'freight',    /* v503: the trip for a lot, RM, typed per purchase, beside the total */
  'coverUnits','coverRM'];   /* v620: reward spent covering a lower margin on a sale he marks, units and the RM they cover at cost */
const CORRECT_DATE=['date','agreedOn','paidOn','deliveredOn','receivedOn','cancelledOn'];
const CORRECT_BOOL=['unpriced','cancelled','pending','inTransit','defaulted','rebate','goodwill'];
const CORRECT_CODE=['party','assoc','downstream'];
/* v373: handover says WHO MOVED THE GOODS, 'delivered' when he drove and 'collected' when
   they came. Absent is not a third answer, it is NO answer: the share of orders delivered
   was a stated 0.20 from v344 to v373 and is now measured over the rows that say, so a row
   that has not been asked has to be distinguishable from one that has. It rides in
   CORRECT_TEXT because everything a text field does is what it needs, an empty box clearing
   the key included; the only thing it adds is a closed list of values, which the drafter
   checks and both editors render as a select rather than a box to mistype into. */
const HANDOVER=['delivered','collected'];
const CORRECT_TEXT=['orderCode','settle','note','handover'];
const CORRECT_REQUIRED=['product','party','qty','total'];
const CORRECTABLE=['product','stream'].concat(CORRECT_NUM_POS,CORRECT_NUM_NN,CORRECT_DATE,
  CORRECT_BOOL,CORRECT_CODE,CORRECT_TEXT);
/* v611: AN R2 ROW BOOKS TO THE ASSOCIATE'S BUCKET, SO THE ASSOCIATE IS WHOEVER OWNS THE CODE IT SITS ON.
   A row filed on the plain code before v611 reads the same way, which is what lets a correction name
   the associate unchanged and still move the row into the bucket. The downstream is read as stored:
   an old row carrying its own bucket there is a leg a correction can clear. */
function attributionOf(row,partyKey){
  const pk=partyKey||(row.supplier!=null?'supplier':'customer');
  if(row.rev==='R2')return {assoc:ownerCode(row[pk]),stream:'R2',downstream:row.downstream||null};
  if(row.ref)return {assoc:row.ref,stream:'R3',downstream:null};
  return {assoc:null,stream:null,downstream:null};
}
/* ====== ONE RULER FOR WHETHER A CORRECTION IS LEGAL (v436) ======================
   FOUR readers decide this and only two ever held a rule. The drafter refused at the gate,
   tools/fold.mjs refused again in --plan with a rule of its own, applyAmend wrote whatever it
   was handed, and the desk's ovAmend PREVIEWED whatever it was handed. So the row editor drew a
   cancelled-and-delivered order as done, and the queue then refused the very edit the desk had
   just shown the owner as applied. A desk and a fold that disagree about what an edit does is two
   books. The cross-field refusals live here now and all four callers read them from one place.
   WHAT STAYS WITH THE DRAFTER: the per-field type and roster checks. It is the only reader taking
   untyped input off the wire; the other three are handed values the drafter has already typed. */
function correctionFaults(row,fields,isSale){
  const f=fields||{};const out=[];
  const partyKey=isSale?'customer':'supplier';
  const at=attributionOf(row,partyKey);
  const now=Object.assign({},row,{party:at.stream==='R2'?(at.downstream||null):(row[partyKey]||null),
    assoc:at.assoc,stream:at.stream,downstream:at.downstream});
  const after=Object.assign({},now);
  Object.keys(f).forEach(k=>{if(f[k]===undefined)return;if(f[k]===null)delete after[k];else after[k]=f[k];});
  /* THE CONTRADICTION, MEASURED WITH THE FLAG STRIPPED. poRecvUnits and txEffDeliv both answer
     nothing for a cancelled row, which is right, and the question here is what the row CARRIES
     regardless of the flag this correction is setting. Measuring the flag's own effect is exactly
     how v417 silently disarmed the drafter's copy of this gate, and round ten found it. */
  const bare=Object.assign({},after);delete bare.cancelled;
  const moved=isSale?txEffDeliv(bare):poRecvUnits(bare);
  if(after.cancelled===true&&moved>0.009)
    out.push('the corrected row would be cancelled AND carry '+moved+' unit already moved, which contradicts itself: restate qty by Modification for what moved, then cancel the remainder');
  /* v462: A CANCELLED-ON DATE NEEDS A CANCELLATION, AND CANNOT PRECEDE THE ORDER. cancelledOn is
     a correctable date (v363) and nothing here read it: a Correction could stamp one on a row that
     is not cancelled, or revive a cancelled row and leave the date behind, or date the
     cancellation before the order was agreed. refundOnCancel dates the refund from it and the
     statement prints it, so the row has to carry it consistently or not at all. */
  if(after.cancelledOn&&after.cancelled!==true)
    out.push('the corrected row would carry a cancelled-on date of '+after.cancelledOn+' without being cancelled: clear the date, or cancel the row with it');
  if(after.cancelled===true&&after.cancelledOn&&after.date&&after.cancelledOn<after.date)
    out.push('the corrected row would be cancelled on '+after.cancelledOn+', before it was agreed on '+after.date);
  /* v494: A DEFAULT IS AN ORDER WITH GOODS OUT AND MONEY OWED, on his instruction of 05 Sep 2026
     that a sale in Advance can be moved to Default from the editor. The Defaulted tick had been
     buy-only on the desk, though every reader of CORRECT_BOOL already carried the flag for a sale;
     showing it needs the rule that the lot side's Default kind has had since v435, on both sides:
     a sale that has handed nothing over is cancelled, not defaulted; a sale paid in full has
     nothing to default on; a lot that has received its salt cannot be defaulted on. It fires on
     a correction that SETS the flag, not on a row that already carries it, or a note edit on the
     book's one defaulted lot would be refused. Measured with the flag stripped, as the
     cancellation rule above is: a defaulted lot answers nothing received by design, so measuring
     it with the flag on would pass every lot. Both found by the suite before it shipped. A
     defaulted lot may still be cancelled, as v421 decided. */
  if(f.defaulted===true){
    const bareD=Object.assign({},after);delete bareD.defaulted;
    if(isSale){
      if(txEffDeliv(bareD)<=0.009)out.push('a sale nothing has been handed over on cannot default: cancel it instead');
      else if(!after.unpriced&&txPaid(bareD)>=(+after.total||0)-0.009)out.push('a sale paid in full has nothing to default on');}
    else{const rcv=poRecvUnits(bareD);if(rcv>0.009)out.push('a lot that has received '+rcv+' unit cannot be defaulted on');}}
  /* AN UNDATED ROW READS AS PENDING EVERYWHERE, which a row with movement is not. Measured on the
     row as it stands, and only when the row actually HAS a date to clear. */
  if(f.date===null&&row.date){
    const eff=isSale?txPaid(row):poCash(row);
    const mvd=isSale?txEffDeliv(row):poRecvUnits(row);
    if(eff>0.005||mvd>0.005)
      out.push('the date cannot be cleared: money or stock has moved against this row, and an undated row reads as pending, which a row with movement is not');}
  /* AN ATTRIBUTION IS THREE FIELDS THAT ONLY MEAN ANYTHING TOGETHER: R2 books the row to the
     associate with the buyer behind it, R3 leaves the buyer on the row and credits the
     introduction. One leg without the others is how a downsell reaches a bucket owed by nobody. */
  /* READ THE LEGS THE WAY THE WRITER WRITES THEM. Both the fold's applyAmend and the desk's
     ovAmend take `no associate` to mean no attribution at all: they delete rev, ref, refKg and
     downstream outright. So a stream left over on the BEFORE state of a row whose associate is
     being cleared is not a contradiction, it is a leg about to be deleted. Lifting the drafter's
     wording literally refused every attribution clear the moment the fold started reading it, and
     the fold's own suite caught it: `clearing an attribution applies` went red. What the rule is
     actually for is a leg being ASSERTED with nobody to credit. */
  const askd=k=>Object.prototype.hasOwnProperty.call(f,k)&&f[k]!==undefined;
  const effAssoc=askd('assoc')?f.assoc:now.assoc;
  const effStream=askd('stream')?f.stream:(effAssoc?now.stream:null);
  if(effAssoc&&!effStream)out.push('an associate needs a stream, R2 or R3, to say how the credit reaches them');
  if(!effAssoc&&((askd('stream')&&f.stream)||(askd('downstream')&&f.downstream)))
    out.push('a stream or a downstream without an associate credits nobody');
  return out;
}
/* ====== A CANCELLED ORDER THAT WAS PAID FOR IS A PAYABLE (v444) =====================
   HIS INSTRUCTION, 02 Sep 2026: record it exactly like an overpayment, cash to be returned to
   the customer as soon as possible. customerRefunds IS that mechanism and its two existing rows
   are literally overpayments, so this writes the same shape rather than inventing a second one:
   {party, amount, since, note}, with paidOn absent until the money actually goes back. Six
   readers already understand it and none of them changes: refundsOut, the cash-flow walk, the
   Order book's open-refunds list, the forecast's day-0 cash out, the action list, and the
   statement's own stmtRefunds. Writing the row is what makes the payable appear in all six.
   THE AMOUNT IS txPaid, NOT row.cash, because what the customer put in is cash plus anything
   settled in kind, and txStat has read it that way since v441. The note records the split when
   there is one, since returning a set-off is not the same act as handing back notes.
   IT IS IDEMPOTENT ON PURPOSE. The desk rebuilds its overlay on every recompute and the fold can
   be re-run, so a second call for the same row must add nothing. rid names the row; where a row
   predates rids, party, amount and since together do.
   THE CALLER OWNS THE LIST. The fold passes book.customerRefunds and the desk passes its own
   array, which is why this takes a list rather than reaching for one. */
function refundOnCancel(list,row,date){
  if(!list||!row||!row.cancelled)return null;
  /* THE THRESHOLD TESTS THE MONEY, NOT THE ROUNDED FIGURE. Rounding first turns RM 0.005 into
     RM 0.01, which then clears 0.009 and books a one-cent payable out of a rounding crumb. Read the
     raw value, decide, then round for storage. */
  const raw=+txPaid(row);
  if(!(raw>0.009))return null;
  const amt=+raw.toFixed(2);
  const party=row.customer||null;
  if(!party)return null;
  const since=date||row.cancelledOn||row.date||null;
  const has=list.some(r=>r&&((row.rid&&r.rid===row.rid)||
    (r.party===party&&Math.abs((+r.amount||0)-amt)<0.011&&(r.since||null)===since)));
  if(has)return null;
  const inKind=+(+(row.settledRM||0)).toFixed(2);
  const rec={party:party,amount:amt,since:since,
    note:'cancelled order'+(row.rid?' '+row.rid:'')+': RM '+amt+' payable back to the customer'
      +(inKind>0.009?', of which RM '+inKind+' was settled in kind':'')+'.'};
  if(row.rid)rec.rid=row.rid;
  list.push(rec);
  return rec;
}
/* the key an amendment names a row by, shared with the phone and the drafter */
function ovKey(t){return (t.customer||t.supplier)+'|'+t.date+'|'+t.total;}
/* ====== WHICH Add ID KIND APPOINTS AN ASSOCIATE, AND WHICH STREAM IT IS FOR (v570) ========
   THREE READERS AND THEY HAVE TO AGREE, which is the same reason CORRECTABLE sits in this file:
   the drafter decides whether to accept the entry, the fold applies it, and the Add ID pane
   previews what the tap will do. A table in three places is a table that will differ.

   THE VALUE IS THE STREAM an appointment starts on. The other kinds -- customer, downstream,
   bucket, supplier -- register a code and confer no standing, which is why they are absent rather
   than listed as false.
   v610, HIS RULING OF 13 SEP 2026: EVERY APPOINTMENT MINTS THE <CODE>-R ACCOUNT, whichever stream it
   starts on. An associate's own buying and their buying to sell on are one stream for the reward,
   and any associate may resell, so a referrer is no longer appointed without one. appointBucket
   below is the one answer the preview, the drafter and the fold all read. */
const ADDID_APPOINTS={reseller:'R2',referral:'R3'};
/* ====== THE BUCKET IS NOT ITS OWN PERSON (his ruling, 13 Sep 2026) ==========================
   An associate's <CODE>-R account holds the salt they buy to sell on. It is theirs: on their
   statement, their price list and the rate the order card calls usual, the code and the bucket
   read as one account, and the bucket has no statement, username or record of its own. One rule,
   stated here, because the statements tool, the price list and the desk all have to agree on it. */
const BUCKET_SFX='-R';
function isBucket(code){return typeof code==='string'&&code.length>BUCKET_SFX.length&&code.slice(-BUCKET_SFX.length)===BUCKET_SFX;}
function ownerCode(code){return isBucket(code)?code.slice(0,-BUCKET_SFX.length):code;}
function ownsCode(party,code){return !!party&&(code===party||code===party+BUCKET_SFX);}
function appointBucket(kind,code){return (ADDID_APPOINTS[kind]&&code)?code+BUCKET_SFX:null;}
/* ====== v611, HIS RULING OF 13 SEP 2026: AN R2 SALE BOOKS TO THE ASSOCIATE'S BUCKET ===============
   Whether or not the end buyer is named: R2 sales are parked under the -R account only, and a buyer
   whose name is known is noted on the row as downstream and credited nothing. The bucket is never a
   buyer, so it is never written as one. ONE WRITER for the four roads that book an R2: the drafter's
   entry, the fold's correction, and the desk's queue branch and correction preview, which disagreed
   about nothing only because each carried the same four lines by hand. */
function bookR2(row,partyKey,assoc,buyer){
  const a=ownerCode(assoc),b=a+BUCKET_SFX;
  row[partyKey]=b;row.rev='R2';
  if(buyer&&buyer!==a&&buyer!==b)row.downstream=buyer;else delete row.downstream;
  return row;
}

return {txPrice:txPrice,txPaid:txPaid,txCost:txCost,txUnitCost:txUnitCost,txDeliv:txDeliv,txPhys:txPhys,txEffDeliv:txEffDeliv,txAdvance:txAdvance,
        txDeferUnits:txDeferUnits,txPendUnits:txPendUnits,txPendUnitsRaw:txPendUnitsRaw,txPendRM:txPendRM,txStat:txStat,txDates:txDates,txGoods:txGoods,
        poRecvUnits:poRecvUnits,poCash:poCash,poLive:poLive,poOwed:poOwed,poRate:poRate,poOpenUnits:poOpenUnits,poStat:poStat,provRate:provRate,saleProvRate:saleProvRate,
        daysBetween:daysBetween,dayAge:dayAge,walk:walk,coverStats:coverStats,commitments:commitments,
        ledgerRow:ledgerRow,openable:openable,ovKey:ovKey,attributionOf:attributionOf,correctionFaults:correctionFaults,refundOnCancel:refundOnCancel,
        CORRECTABLE:CORRECTABLE,CORRECT_REQUIRED:CORRECT_REQUIRED,CORRECT_NUM_POS:CORRECT_NUM_POS,
        CORRECT_NUM_NN:CORRECT_NUM_NN,CORRECT_DATE:CORRECT_DATE,CORRECT_BOOL:CORRECT_BOOL,
        CORRECT_CODE:CORRECT_CODE,CORRECT_TEXT:CORRECT_TEXT,HANDOVER:HANDOVER,
        ADDID_APPOINTS:ADDID_APPOINTS,BUCKET_SFX:BUCKET_SFX,isBucket:isBucket,ownerCode:ownerCode,ownsCode:ownsCode,appointBucket:appointBucket,bookR2:bookR2};
})();
export default POSITION_ENGINE;
