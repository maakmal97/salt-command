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
function txDeliv(s){return (s.deliveredQty||0)+(s.settledKg||0);}
function txPhys(s){return (s.deliveredQty||0);}
function txEffDeliv(s){return txDeliv(s)+(s.advanceKg||0);}
function txAdvance(s){return Math.max(0,(s.deliveredQty||0)*txPrice(s)-txPaid(s));}
function txDeferKg(s){const p=txPrice(s);if(!(p>0))return 0;return Math.max(0,txPaid(s)/p-txEffDeliv(s));}
function txPendKg(s){if(s.cancelled)return 0;return Math.max(0,+(s.qty-txEffDeliv(s)-txDeferKg(s)).toFixed(2));}
function txPendKgRaw(s){if(s.cancelled)return 0;return Math.max(0,s.qty-txEffDeliv(s)-txDeferKg(s));}
function txPendRM(s){if(s.cancelled)return 0;const p=txPrice(s);if(!(p>0))return 0;return +(Math.max(0,s.qty-txEffDeliv(s)-txDeferKg(s))*p).toFixed(2);}
function txStat(t){
  if(t.cancelled)return {order:'Cancelled',cls:'def',pay:(t.cash||0)>0.009?'Refund due':'Unpaid',deliv:'Undelivered'};
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
  return {order,cls,pay,deliv};
}
function txDates(s){
  const am=s.amend||[];
  const kgSteps=am.filter(a=>a.kind==='Fulfilment'&&+a.kg>0.0001);
  const cashSteps=am.filter(a=>+a.cash>0.0001);
  const phys=txPhys(s), eff=txEffDeliv(s), paid=txPaid(s);
  const full=s.qty>0&&eff>=s.qty-0.01, fullPaid=s.total>0&&paid>=s.total-0.01;
  let dOn=null,dSrc=null,pOn=null,pSrc=null;
  if(s.cancelled){return {dOn:null,dSrc:'cancelled',pOn:null,pSrc:'cancelled',full:false,fullPaid:false};}
  if(eff>0.0001){
    if(!full){dSrc='partial';}
    else if(kgSteps.length){dOn=kgSteps[kgSteps.length-1].date||s.date;dSrc='trail';}
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
function poRecvKg(p){
  if(p.defaulted)return 0;
  /* a PENDING lot is agreed and nothing more: no money has moved and no salt has landed,
     so it must not be read as received. Without this it defaults to fully received and
     silently walks into stock, the cost basis and therefore every margin on the desk. */
  if(p.pending)return 0;
  if(p.receivedQty!=null)return Math.max(0,Math.min(+p.receivedQty,p.qty));
  return p.inTransit?0:p.qty;
}
function poCash(p){
  if(p.pending)return 0;                       // agreed only: no money has moved
  if(p.cash!=null)return +p.cash;              // an explicit figure always wins
  return p.status==='paid'?+p.total:0;         // only a row that SAYS paid is assumed paid
}
function poLive(p){return !p.pending&&!p.defaulted;}
function poRate(p){return p.qty>0?p.total/p.qty:0;}
function poOpenKg(p){return +(p.qty-poRecvKg(p)).toFixed(4);}
function provRate(days){return days>=21?1:days>=14?0.75:days>=8?0.5:days>=4?0.25:0;}
/* ============ THE WALK (was recompute) ============
   Everything the desk's tabs read about a product is set by one pass over that product's
   rows: what arrived, what left, what the shelf carries, what is owed each way, and what the
   book earned. Ported verbatim; the globals it used to set are the fields of W, and the facts
   it used to read are the fields of I:
     sales, purchases   this product's rows only, or oil sold would eat salt off the shelf
     opening            {qty, costPerKg, stated, uncounted} for the product
     isSalt             loans and the supplier receivable are salt arrangements
     loanKg             units drawn against loans (salt only; pre-opening loans are inside the opening count)
     counted            the hand count that beats the ledger, or null when this book was never counted
     supplierReceivable {amount, since, status} or null
     today              the as-of date, for ageing the receivables
     wavgBuyPrev        the weighted buying rate as it stood before this pass: goodwill is
                        valued with it, exactly as the desk always has, because that line runs
                        before the rate is recomputed */
function daysBetween(today,d){return Math.floor((today-new Date(d))/86400000+1e-9);}
function walk(I){
  const _S=I.sales||[], _B=I.purchases||[];
  const today=(I.today instanceof Date)?I.today:new Date(I.today);
  const dbet=d=>daysBetween(today,d);
  const W={};
  W.receivedPO=_B.filter(p=>!p.defaulted&&poRecvKg(p)>0.0001);
  W.defaultPO=_B.filter(p=>p.defaulted);
  /* v280, HIS RULING: goodwill is an EXPENSE, not a sale. The row stays in sales so the salt it
     moved still leaves the shelf; it is only kept out of the priced set. */
  W.pricedSales=_S.filter(s=>{const o=txStat(s).order;return o!=='Pending'&&o!=='Cancelled'&&!s.goodwill;});
  W.goodwillRM=+_S.filter(s=>s.goodwill).reduce((a,s)=>a+(s.qty||0)*(s.cost!=null?s.cost:I.wavgBuyPrev),0).toFixed(2);
  /* the cost basis follows the units ACTUALLY ON THE SHELF, valued at the rate of the lot they
     came off: a part-delivered lot enters as it lands, not whole on the first unit */
  W.buyKg=W.receivedPO.reduce((s,p)=>s+poRecvKg(p),0);
  W.buyRM=W.receivedPO.reduce((s,p)=>s+poRecvKg(p)*poRate(p),0);
  const _op=I.opening||{qty:0,costPerKg:null,stated:null,uncounted:true};
  const openInCost=_op.costPerKg!=null;
  const costKg=W.buyKg+(openInCost?_op.qty:0);
  const costRM=W.buyRM+(openInCost?_op.qty*_op.costPerKg:0);
  W.wavgBuy=costKg>0?costRM/costKg:0;                 // no lots yet is not a division by nothing
  const loanKg=I.isSalt?(+I.loanKg||0):0;
  const drawnKg=_S.reduce((a,s)=>a+txPhys(s),0)+loanKg;
  W.soldKg=drawnKg;
  W.ledgerStock=+(_op.qty+W.buyKg-drawnKg).toFixed(2);
  /* A COUNT AND A ZERO ARE DIFFERENT CLAIMS: a counted shelf beats the ledger; a book never
     counted falls back to what the ledger says rather than inventing a count. */
  const _cnt=I.counted;
  W.stockCounted=_cnt!=null;
  W.currentStock=+((_cnt!=null?_cnt:W.ledgerStock)).toFixed(2);
  W.selfUse=W.stockCounted?Math.max(0,+(_op.qty+W.buyKg-drawnKg-W.currentStock).toFixed(2)):0;
  W.revTotal=W.pricedSales.reduce((a,s)=>a+(s.total||0)-txPendRM(s),0);   // net of any pending tail on a part-moved order
  W.revCollected=_S.reduce((a,s)=>a+(s.cash||0),0);
  /* AR = advance only: pending unpaid-and-undelivered is not a receivable */
  W.arList=_S.filter(s=>txAdvance(s)>0.009);
  W.arGross=W.arList.reduce((a,s)=>a+txAdvance(s),0);
  W.ar=Math.max(0,+W.arList.reduce((a,s)=>a+txAdvance(s)*(1-provRate(dbet(s.date))),0).toFixed(2)); // net of provisioning
  W.advTotal=W.arGross;
  W.defKg=+_S.reduce((a,s)=>a+txDeferKg(s),0).toFixed(2);
  const _sr=I.isSalt?(I.supplierReceivable||null):null;
  W.supRecovGross=_sr?_sr.amount:0;
  const srDays=_sr?dbet(_sr.since):0;
  W.supRecovNet=(_sr&&_sr.status==='writtenOff')?0
    :+(W.supRecovGross*(1-provRate(srDays))).toFixed(2);
  W.cogs=W.pricedSales.reduce((a,s)=>a+(s.qty-txPendKgRaw(s))*(s.cost!=null?s.cost:W.wavgBuy),0);  // no cost against salt not yet moved
  W.grossMargin=W.revTotal-W.cogs;W.marginPct=W.revTotal>0?W.grossMargin/W.revTotal*100:0;
  return W;
}
/* ============ COVER ============ how many days the free shelf lasts at the rate actually shipped */
function coverStats(S){
  const MS=86400000, today=(S.today instanceof Date)?S.today:new Date(S.today);
  const rows=S.pricedSales||[];
  const win=n=>{const from=new Date(today.getTime()-n*MS);
    return +rows.filter(s=>new Date(s.date)>=from).reduce((a,s)=>a+txPhys(s),0).toFixed(2);};
  const kg14=win(14),kg28=win(28);
  const rate14=+(kg14/14).toFixed(3),rate28=+(kg28/28).toFixed(3);
  const rate=rate14>0?rate14:rate28;
  const free=+(S.currentStock-S.defKg).toFixed(2),usable=Math.max(0,free);
  const days=rate>0?+(usable/rate).toFixed(1):null;
  const zero=days!=null?new Date(today.getTime()+days*MS):null;
  return {kg14,kg28,rate14,rate28,rate,free,days,zero,
    reorderAt:S.reorderKg,below:free<S.reorderKg,shortBy:+(S.reorderKg-usable).toFixed(2)};
}
/* ============ COMMITMENTS ============ what is owed out (paid ahead of delivery) and promised
   (agreed, nothing moved), which is the part of the forecast the phone and the drafter read */
function commitments(sales,currentStock){
  const rows=sales||[];
  const defRows=rows.filter(s=>txDeferKg(s)>0.009)
    .map(s=>({id:s.customer,kg:+txDeferKg(s).toFixed(2),rm:0,why:'paid ahead of delivery'}));
  const pendRows=rows.filter(s=>txPendKg(s)>0.009)
    .map(s=>({id:s.customer,kg:+txPendKg(s).toFixed(2),rm:txPendRM(s),why:'agreed, nothing moved'}));
  const owedKg=+defRows.reduce((a,r)=>a+r.kg,0).toFixed(2);
  const promKg=+pendRows.reduce((a,r)=>a+r.kg,0).toFixed(2);
  const promRM=+pendRows.reduce((a,r)=>a+r.rm,0).toFixed(2);
  const commitKg=+(owedKg+promKg).toFixed(2);
  return {defRows,pendRows,owedKg,promKg,promRM,commitKg,
    shortKg:+Math.max(0,commitKg-currentStock).toFixed(2), coverable:currentStock>=commitKg};
}
/* ============ A ROW AS THE PHONE SEES IT ============ the ledger and open-order shape of the
   payload: what was traded, what moved, what is still to be handed over each way, and a state
   word. No cost and no margin, because the phone is public. */
function ledgerRow(t,dir,defaultProd){
  const q=+t.qty||0, tot=+t.total||0;
  const buy=(dir==='B');
  const paidRM=buy?poCash(t):txPaid(t);
  const mv=buy?poRecvKg(t):txEffDeliv(t);
  const oweRM=+Math.max(0,tot-paidRM).toFixed(2);      // money still to be handed over
  const oweKg=+Math.max(0,q-mv).toFixed(2);            // goods still to be handed over
  let st;
  if(t.cancelled) st='canc';
  else if(!t.date||t.pending) st='pend';
  else if(oweRM<0.005&&oweKg<0.005) st='done';
  else if(oweKg>=0.005&&oweRM>=0.005) st='part';
  else if(oweKg>=0.005) st=buy?'dueStock':'oweStock';
  else st=buy?'oweMoney':'dueMoney';
  const r={ d:t.date||null, p:t.customer||t.supplier||'', dir:dir,
    q:q, t:tot, cash:+paidRM.toFixed(2), mv:+mv.toFixed(2), st:st };
  if(oweRM>=0.005) r.oweRM=oweRM;
  if(oweKg>=0.005) r.oweKg=oweKg;
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
const CORRECT_NUM_NN=['total','cash','deliveredQty','receivedQty','cost',
  'settledRM','settledKg','rebateKg'];
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
function attributionOf(row,partyKey){
  const pk=partyKey||(row.supplier!=null?'supplier':'customer');
  if(row.rev==='R2')return {assoc:row[pk],stream:'R2',downstream:row.downstream||null};
  if(row.ref)return {assoc:row.ref,stream:'R3',downstream:null};
  return {assoc:null,stream:null,downstream:null};
}
/* the key an amendment names a row by, shared with the phone and the drafter */
function ovKey(t){return (t.customer||t.supplier)+'|'+t.date+'|'+t.total;}

return {txPrice:txPrice,txPaid:txPaid,txDeliv:txDeliv,txPhys:txPhys,txEffDeliv:txEffDeliv,txAdvance:txAdvance,
        txDeferKg:txDeferKg,txPendKg:txPendKg,txPendKgRaw:txPendKgRaw,txPendRM:txPendRM,txStat:txStat,txDates:txDates,
        poRecvKg:poRecvKg,poCash:poCash,poLive:poLive,poRate:poRate,poOpenKg:poOpenKg,provRate:provRate,
        daysBetween:daysBetween,walk:walk,coverStats:coverStats,commitments:commitments,
        ledgerRow:ledgerRow,openable:openable,ovKey:ovKey,attributionOf:attributionOf,
        CORRECTABLE:CORRECTABLE,CORRECT_REQUIRED:CORRECT_REQUIRED,CORRECT_NUM_POS:CORRECT_NUM_POS,
        CORRECT_NUM_NN:CORRECT_NUM_NN,CORRECT_DATE:CORRECT_DATE,CORRECT_BOOL:CORRECT_BOOL,
        CORRECT_CODE:CORRECT_CODE,CORRECT_TEXT:CORRECT_TEXT,HANDOVER:HANDOVER};
})();
export default POSITION_ENGINE;
