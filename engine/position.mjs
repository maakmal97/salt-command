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
function stockCountEntry({at,product,date,qty}){
  return {at,type:'COUNT',party:'stock count',qty,total:null,status:'count',
    raw:'Stock count: '+qty+' unit '+product+' on hand on '+date,
    payload:{mode:'count',product,direction:null,party:null,date,qty,total:null,cash:null,kg:qty,
      assoc:null,downstream:null,kind:null,orderCode:null,linkTo:null,note:null}};
}
function rewardMargin({id,refs=[],sales=[],averageCost=0}){
  const mine={margin:0,n:0},intro={margin:0,n:0};
  sales.forEach(s=>{
    const st=txStat(s).order;
    if(st==='Default'||st==='Pending'||st==='Cancelled'||s.cancelled)return;
    const owner=ownerCode(s.customer),part=owner===id?mine:refs.includes(owner)?intro:null;
    if(!part)return;
    if(s.goodwill){
      if(!s.rebate)part.margin-=(s.qty||0)*txUnitCost(s,averageCost);
      return;
    }
    let rm=s.total||0,q=s.qty||0;
    if(s.rebate){
      rm=Math.max(0,rm-(+s.settledRM||0));
      q=Math.max(0,q-(s.rebateKg!=null?+s.rebateKg:(s.qty||0)));
      if(rm<0.009&&q<1e-9)return;
    }
    part.margin+=rm-q*txUnitCost(s,averageCost);part.n++;
  });
  mine.margin=+mine.margin.toFixed(2);intro.margin=+intro.margin.toFixed(2);
  return {mine,intro,total:+(mine.margin+intro.margin).toFixed(2)};
}
function rewardUnits(total,unit){
  if(unit==null)return {earned:0,toNext:null};
  const earned=Math.max(0,Math.floor(total/unit));
  return {earned,toNext:+((earned+1)*unit-total).toFixed(2)};
}
function rewardAccount(book,id,product='salt'){
  const state=book.state||{},scheme=state.REWARD&&state.REWARD.stated&&state.REWARD.stated[product];
  if(!scheme||!Number.isFinite(+scheme.margin)||+scheme.margin<=0)return {error:'This book has no configured reward.'};
  const allSales=book.sales||[],sales=allSales.filter(s=>(s.product||'salt')===product);
  const introductions=state.INTRODUCTIONS||[];
  const associate=(state.associates||[]).includes(id)
    ||allSales.some(s=>s.rev==='R2'&&ownerCode(s.customer)===id||s.ref===id)
    ||introductions.some(e=>e&&e.by===id)
    ||!!(state.R0_NETWORK&&state.R0_NETWORK.reseller===id);
  const refs=new Set();
  if(associate){
    allSales.forEach(s=>{if(s.ref===id&&s.customer)refs.add(ownerCode(s.customer));});
    introductions.forEach(e=>{if(e&&e.by===id&&e.customer)refs.add(ownerCode(e.customer));});
  }
  const opening=state.PROD_OPENING&&state.PROD_OPENING[product]||{qty:0,costPerKg:null};
  const lots=(book.purchases||[]).filter(p=>(p.product||'salt')===product&&!p.defaulted&&poRecvUnits(p)>0.0001);
  const buyUnits=lots.reduce((n,p)=>n+poRecvUnits(p),0),buyRM=lots.reduce((n,p)=>n+poRecvUnits(p)*poRate(p),0);
  const openUnits=opening.costPerKg!=null?(+opening.qty||0):0;
  const averageCost=buyUnits+openUnits>0?(buyRM+openUnits*(+opening.costPerKg||0))/(buyUnits+openUnits):0;
  const margin=rewardMargin({id,refs:[...refs],sales,averageCost});
  const hurdle=associate?(+((scheme.associate||{}).margin)||+scheme.margin):+scheme.margin;
  const pooled=+(associate?margin.mine.margin+margin.intro.margin/(+((scheme.associate||{}).r3Hurdle)||1):margin.mine.margin).toFixed(2);
  const {earned}=rewardUnits(pooled,hurdle);
  const applied=+sales.reduce((n,s)=>ownerCode(s.customer)===id
    ?n+(s.rebate?(s.rebateKg!=null?+s.rebateKg:(+s.qty||0)):0)+Math.max(0,+s.coverUnits||0):n,0).toFixed(2);
  if(((state.PEOPLE||{}).departed||[]).some(p=>p&&p.id===id))
    return {error:"A departed party's reward waits until they return."};
  return {earned,applied,held:+(earned-applied).toFixed(2),associate,margin:pooled};
}
function rewardReservation(entry,book){
  const p=entry&&entry.payload;if(!p)return null;
  if(p.mode==='redeem')return {party:ownerCode(p.party),product:p.product||'salt',units:+p.qty||0};
  if(p.mode==='new'&&p.direction==='SELL'&&p.more&&+p.more.coverUnits>0)
    return {party:ownerCode(p.party),product:p.product||'salt',units:+p.more.coverUnits};
  if(p.mode==='amend'&&p.kind==='Correction'&&p.direction!=='BUY'&&p.fields){
    const row=(book.sales||[]).find(s=>p.rid?s.rid===p.rid:ovKey(s)===p.orderKey);
    if(!row)return null;
    const f=p.fields;
    const attribution=attributionOf(row);
    const terms={party:attribution.stream==='R2'?(attribution.downstream||null):row.customer,
      assoc:attribution.assoc,stream:attribution.stream,...f};
    const customer=terms.stream==='R2'&&terms.assoc?bookR2({},'customer',terms.assoc,null).customer
      :row.rev==='R2'&&!terms.assoc?terms.party||ownerCode(row.customer):terms.party||row.customer;
    const after={...row,...f,customer};
    const spent=s=>(s.rebate?(s.rebateKg!=null?+s.rebateKg:(+s.qty||0)):0)+Math.max(0,+s.coverUnits||0);
    const same=ownerCode(after.customer)===ownerCode(row.customer)&&(after.product||'salt')===(row.product||'salt');
    const units=Math.max(0,spent(after)-(same?spent(row):0));
    if(units>0.009)return {party:ownerCode(after.customer),product:after.product||'salt',units};
  }
  return null;
}
function entryReservationFault(entry,pending,book){
  const p=entry&&entry.payload;if(!p)return '';
  const entries=[...new Map((pending||[]).filter(e=>e&&e.at!==entry.at).map(e=>[e.at,e])).values()];
  if(p.mode==='repay'){
    const loan=((book.state||{}).loans||[]).find(l=>l&&l.rid===p.loan);
    if(!loan)return 'The loan no longer exists.';
    const cash=loan.form==='cash',field=cash?'rm':'kg';
    const paid=(loan.repaid||[]).reduce((n,r)=>n+(+r[field]||0),0);
    const reserved=entries.reduce((n,e)=>e.payload&&e.payload.mode==='repay'&&e.payload.loan===p.loan?n+(+e.payload[field]||0):n,0);
    const room=(cash?+loan.valueRM:+loan.valueKg)-paid-reserved;
    if(loan.status==='settled'||!(+p[field]>0)||+p[field]>room+0.005)
      return 'This repays '+(+p[field]||0)+' against '+(+room.toFixed(2))+' still owing after payments already on their way.';
  }
  const spend=rewardReservation(entry,book);
  if(spend){
    const balance=rewardAccount(book,spend.party,spend.product);
    if(balance.error)return balance.error;
    const reserved=entries.reduce((n,e)=>{
      const held=rewardReservation(e,book);
      return held&&held.party===spend.party&&held.product===spend.product?n+held.units:n;
    },0);
    if(spend.units>balance.held-reserved+0.005)
      return 'The reward is already spent or reserved by another input awaiting its fold.';
  }
  return '';
}
function inputConsumesResource(entry){
  const p=entry&&entry.payload;
  return !!p&&(p.mode==='repay'||p.mode==='redeem'
    ||p.mode==='new'&&p.more&&+p.more.coverUnits>0
    ||p.mode==='amend'&&p.kind==='Correction'&&p.fields
      &&['rebate','rebateKg','coverUnits','qty','party','product','assoc','stream','downstream'].some(k=>Object.hasOwn(p.fields,k)));
}
function inputResource(entry,book){
  const p=entry&&entry.payload;if(!p)return null;
  if(p.mode==='repay'){
    const loan=((book.state||{}).loans||[]).find(l=>l&&l.rid===p.loan);
    if(!loan||loan.status==='settled')return {error:'Choose an open loan.'};
    const cash=loan.form==='cash',field=cash?'rm':'kg';
    const paid=(loan.repaid||[]).reduce((n,r)=>n+(+r[field]||0),0);
    return {resource:'loan:'+loan.rid,amount:+p[field]||0,available:(cash?+loan.valueRM:+loan.valueKg)-paid};
  }
  const spend=rewardReservation(entry,book);
  if(!spend)return null;
  const reward=rewardAccount(book,spend.party,spend.product);
  return reward.error?reward:{resource:'reward:'+spend.product+':'+spend.party,amount:spend.units,available:reward.held};
}
function tradeEntry({at,product,direction,party,date,qty,total,cash,movedUnits,delivery=0,freight=0,
  handover=null,assoc=null,stream=null,downstream=null,note=null,second=null,more=null,coverFree=null,trip=null,raw}){
  const booking={customer:party};
  if(direction==='SELL'&&assoc&&stream==='R2')bookR2(booking,'customer',assoc,downstream);
  const state=txStat({total,qty,cash,delivery,deliveredQty:movedUnits});
  const status=state.pay==='Paid'?'paid':state.pay==='Unpaid'?'unpaid':'partial';
  return {at,type:direction,party:booking.customer,qty,total,status,
    raw:raw===undefined?(direction==='SELL'?'Sell ':'Buy ')+qty+' unit '+product
      +(direction==='SELL'?' to ':' from ')+booking.customer+' for RM'+total+' on '+date
      +(delivery>0.009?' plus RM'+delivery+' delivery':'')+(freight>0.009?' plus RM'+freight+' freight':'')
      +(handover?', '+handover:'')+', RM'+cash+' cash, '+movedUnits+' unit moved → '+state.order
      +(assoc?(stream==='R2'?' (R2 via ':' (R3 referred by ')+assoc+')':'')
      +(downstream?', end buyer '+downstream:''):raw,
    payload:{mode:'new',product,direction,party,newId:null,date,qty,total,delivery,freight,cash,
      kg:movedUnits,assoc,stream,downstream,kind:null,orderCode:null,linkTo:null,note,
      handover,second,more,coverFree,...(trip?{trip}:{})}};
}
function tierSetEntry({at,tiers,raw}){
  const codes=Object.keys(tiers),copied={};
  codes.forEach(c=>{copied[c]={};Object.keys(tiers[c]).forEach(p=>{
    const t=tiers[c][p];copied[c][p]=t&&typeof t==='object'?Object.assign({},t):t;
  });});
  const say=t=>t==null?'not set':typeof t==='string'?t:['small','mid','big'].filter(k=>t[k]).map(k=>k+' '+t[k]).join(', ');
  return {at,type:'TIER',party:codes.length===1?codes[0]:null,qty:null,total:null,status:'tierset',
    raw:raw===undefined?'Set '+codes.map(c=>c+': '+Object.keys(copied[c]).map(p=>p+' '+say(copied[c][p])).join(', ')).join('; '):raw,
    payload:{mode:'tierset',tiers:copied}};
}
function loanEntry({at,product,direction,party,date,form,amount,note=null,raw}){
  const cash=form==='cash',type=direction==='in'?'BORROW':'LEND';
  return {at,type,party,qty:cash?null:amount,total:cash?amount:null,status:'open',
    raw:raw===undefined?(cash?(direction==='in'?'Borrowed ':'Lent ')+'RM'+amount+' in cash '+(direction==='in'?'from ':'to ')+party+' on '+date
    :(direction==='in'?'Borrowed ':'Lent ')+amount+' unit '+product+' '+(direction==='in'?'from ':'to ')+party+' on '+date):raw,
    payload:{mode:'loan',form,product:cash?null:product,direction,party,date,qty:cash?null:amount,
    total:cash?amount:null,cash:null,kg:cash?null:amount,rm:cash?amount:null,note}};
}
function repaymentEntry({at,loan,party,date,form,product,amount,note=null,raw}){
  const cash=form==='cash';
  return {at,type:'REPAY',party,qty:cash?null:amount,total:cash?amount:null,status:'open',
    raw:raw===undefined?'Repaid '+(cash?'RM'+amount:amount+' unit '+product)+' '+(loan.direction==='in'?'to ':'by ')+party+' against loan '+loan.rid+' on '+date:raw,
    payload:{mode:'repay',loan:loan.rid,party:loan.party,date,kg:cash?null:amount,rm:cash?amount:null,
    qty:null,total:null,cash:null,note}};
}
function giftEntry({at,product,party,date,qty,movedUnits=qty,handover=null,note=null,raw}){
  return {at,type:'GIFT',party,qty,total:0,status:'inkind',
    raw:raw===undefined?'Give '+qty+' unit '+product+' free to '+party+' on '+date:raw,
    payload:{mode:'gift',product,party,qty,date,kg:movedUnits,handover,note}};
}
function redeemEntry({at,product,party,date,qty,earned,applied,balance}){
  return {at,type:'REDEEM',party,qty,total:0,status:'inkind',
    raw:'Redeem '+qty+' free unit '+product+' for '+party+' on '+date,
    payload:{mode:'redeem',product,party,qty,date,earned,applied,balance}};
}
function rebateOffsetEntry({at,party,date,sale,units,rm,raw,auto=false}){
  return {at,type:'AMEND',party,qty:0,total:0,status:'inkind',
    raw:raw===undefined?'Rebate offset '+units+' unit for '+party+' against '+(sale.date||'undated')+' order, RM'+rm+' settled in kind':raw,
    payload:{...(auto?{auto:true}:{}),mode:'amend',kind:'Correction',direction:'SELL',party,rid:sale.rid||null,
    orderKey:ovKey(sale),date,fields:{settledRM:+((+sale.settledRM||0)+rm).toFixed(2),
      rebate:true,rebateKg:+((+sale.rebateKg||0)+units).toFixed(2)}}};
}
function addIdEntry({at,code,kind,parent=null,rev=null,geo=null,tiers=null,note=null,raw}){
  return {at,type:'ADDID',party:code,qty:null,total:null,status:'addid',
    raw:raw===undefined?'Add '+code+' to the roster as '+kind+(parent?' under '+parent:''):raw,
    payload:{mode:'addid',code,kind,parent,rev,note,geo,tiers}};
}
function renameEntry({at,from,to,geo=null,raw}){
  return {at,type:'RENAME',party:from,qty:null,total:null,status:'rename',
    raw:raw===undefined?'Amend ID: re-key '+from+' to '+to+' wherever the book names it':raw,
    payload:{mode:'rename',from,to,geo}};
}
function placeEntry({at,places,party=null,raw}){
  const codes=Object.keys(places);
  return {at,type:'PLACE',party,qty:null,total:null,status:'place',
    raw:raw===undefined?'Place '+codes.length+(codes.length===1?' party':' parties')+' on the map: '+codes.join(', '):raw,
    payload:{mode:'place',places}};
}
function ledgerAmendmentEntry({at,row,direction,kind,date,cash=0,movedUnits=0,fields,
  party=direction==='BUY'?row.supplier:row.customer,note=null,raw,status,orderCode=null,sameDay=date===row.date}){
  if(!['Correction','Fulfilment','Cancellation','Modification','Default'].includes(kind)
    && !(direction==='BUY'&&['Payment','Receipt'].includes(kind)))
    throw new Error('This amendment kind is retired or unsupported.');
  const correction=kind==='Correction',cancel=kind==='Cancellation',mod=kind==='Modification';
  return {at,type:'AMEND',party,qty:cancel||mod?null:correction?0:movedUnits,total:cancel||mod?null:correction?0:cash,
    status:status|| (cancel?'cancelled':correction?'corrected':mod?'modified':kind==='Default'?'defaulted':'partial'),
    raw:raw===undefined?kind+' against '+row.rid+' for '+party+' on '+date:raw,
    payload:{mode:'amend',direction,party,product:row.product||'salt',rid:row.rid||null,orderKey:ovKey(row),
      date,kind,orderCode,linkTo:null,assoc:null,downstream:null,sameDay,note,
      ...(correction?{fields:{...fields},qty:0,total:0,cash:0,kg:0}
        :mod?{newTotal:cash,newQty:movedUnits,wasTotal:row.total,wasQty:row.qty,qty:null,total:null,cash:null,kg:null}
        :cancel?{qty:null,total:null,cash:null,kg:null}
        :{qty:movedUnits,total:cash,cash,kg:movedUnits})}};
}
/* ---- the row helpers, verbatim from the desk ---- */
/* ============ 19 SEP 2026, HIS INSTRUCTION: THE PRICE AND THE CARRIAGE ARE SEPARATE ============
   "Please completely separate sell price and delivery price, from the ledger, enter, statement,
   order. Do the same for buy price and freight."
   A SALE'S `total` IS THE GOODS ALONE NOW, and `delivery` sits BESIDE it, which is the convention a
   purchase has always had. Until today the two sides carried opposite conventions and both failure
   modes had just been seen on the live book within a day: p025 double-counted its freight because a
   purchase's sits beside the total and a person added it in as well, and s172 absorbed its carriage
   into the rate because a sale's had nowhere else to go, reading RM52.50 a unit against RM90.
   WHAT THEY OWE IS THE GOODS PLUS THE CARRIAGE, which is what txPrice answers and what every
   reading of what is owed, paid, advanced or deferred is struck on. The rate is txGoods over the
   quantity and is now the total itself, so the derivation that used to be written out in twelve
   places is written in none. */
function txOwed(s){return (+s.total||0)+(+s.delivery||0);}
function txPrice(s){return s.qty>0?txOwed(s)/s.qty:0;}
function txPaid(s){return (s.cash||0)+(s.settledRM||0);}
/* v502: the goods half of an order; the rate a unit was sold at is this over the quantity.
   19 Sep 2026: and it IS the total now, the carriage having moved out beside it. Kept as a named
   function rather than inlined, because every reader that means "the goods" should say so: the day
   the convention changed, a bare `total` would have been right by luck in twelve places and wrong
   in the twelve that meant what they owe. */
function txGoods(s){return +(s.total||0);}
/* S11 11.9: WHAT AN ORDER CLOSED SHORT COMES TO, the goods at the rate agreed pro rata to the units that went, to the sen.
   The ONE copy: the desk's card shows it and the desk Worker sends it to the site as a stated figure, the site pricing
   nothing. Whether a short close charges this or their card at the size that went awaits his word (24 Sep 2026). */
function closeGoods(total,qty,n){return qty>0?+((+total||0)*n/qty).toFixed(2):0;}
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
/* v634, HIS INSTRUCTION OF 14 SEP 2026: "Write-off defaulted entries". A DEFAULTED SALE IS WRITTEN OFF, not carried.
   Since 05 Sep a declared default was provisioned in full and kept as gross owed, so the desk went on chasing it,
   counting it against the party's credit and offering the party more. What a defaulted sale still has out and unpaid
   is now written off: txAdvance reads nothing owed on it, as poOwed has read nothing owed on a defaulted lot since
   v438, and txWrittenOff carries the figure to every reading of what was LOST, so no loss leaves the book. */
function txUnpaidOut(s){return Math.max(0,(s.deliveredQty||0)*txPrice(s)-txPaid(s));}
function txAdvance(s){return s.defaulted?0:txUnpaidOut(s);}
function txWrittenOff(s){return s.defaulted?txUnpaidOut(s):0;}
/* 28 SEP 2026, HIS INSTRUCTION: OVERDUE IS COUNTED FROM THE DAY THE GOODS WERE COLLECTED OR DELIVERED. txUnpaidSince
   names that day for the goods still unpaid: the handovers walked in date order against the units the money covers,
   the day of the first handover that goes past them, so money paid for the first units starts no clock and a later
   handover restarts none. A unit step carries its own day: a Fulfilment moving units, or a Correction restating what
   moved, which the fold writes with the difference since 28 Sep 2026 (a reversal's is negative). Units handed over
   with no step of their own (a Correction folded before then) went on deliveredOn, the last handover's day, else on
   the row's date. Null where nothing handed over is unpaid (txAdvance: a write-off or a cancelled row owes nothing),
   and where no day is known. */
function txUnpaidSince(s){
  if(!s||s.cancelled||!(txAdvance(s)>0.009))return null;
  const p=txPrice(s),paidU=p>0?txPaid(s)/p:0;
  let cum=0;
  for(const x of txHandSteps(s)){cum+=x.u;if(cum>paidU+0.0001)return x.d||null;}
  return null;
}
/* THE UNITS A ROW HAS HANDED OVER, oldest first, each with its day (V5c, 29 Sep 2026, out of txUnpaidSince, which walks
   them): the units they hold, units handed back leaving the latest handover first, and a trail stating more than
   deliveredQty cut from the latest too, so what is walked is what they hold. `dated` is false where the day is only the
   row's own date, no step or deliveredOn naming one. */
function txHandSteps(s){
  const phys=txPhys(s);
  const steps=(s.amend||[]).filter(a=>a&&a.date&&((a.kind==='Fulfilment'&&+a.kg>0.0001)||(a.kind==='Correction'&&Math.abs(+a.kg||0)>0.0001)))
    .map(a=>({d:String(a.date),u:+a.kg,dated:true}));
  const rest=phys-steps.reduce((t,x)=>t+x.u,0);
  if(rest>0.0001)steps.push({d:s.deliveredOn||s.date||'',u:rest,dated:!!s.deliveredOn});
  steps.sort((a,b)=>a.d.localeCompare(b.d));
  const held=[],drop=n=>{while(n>0.0001&&held.length){const x=held[held.length-1],t=Math.min(n,x.u);x.u-=t;n-=t;if(x.u<=0.0001)held.pop();}};
  for(const x of steps){if(x.u>0)held.push({d:x.d,u:x.u,dated:x.dated});else drop(-x.u);}
  drop(held.reduce((t,x)=>t+x.u,0)-phys);
  return held;
}
/* V5c (his answers of 29 Sep 2026): HOW LATE EACH ROW WAS PAID, in days from its handover. Every row the party owns
   (their bucket included), not cancelled and not a gift, whose every handover is dated. Paid in full: each stage of the
   handover is covered by the money in the order it came (the trail, what came with the row on its own date), and the
   row's delay is its latest-covered stage's; paid on a stated day with no trail, that day less the first handover.
   A row paid on a day only assumed counts neither way. Unpaid with goods out, the days since txUnpaidSince, listed
   only once past the term (`open`). A write-off is a delay of the lock, dated its first handover plus the lock. Paid
   ahead reads 0. Days are calendar dates. */
const dayNo=d=>Math.round(Date.parse(String(d).slice(0,10)+'T00:00:00Z')/864e5);
const dayIso=n=>new Date(n*864e5).toISOString().slice(0,10);
function payDelays(sales,party,today,rules){
  const R=rules||{},term=R.holdDays!=null?+R.holdDays:1,lock=R.lockDays!=null?+R.lockDays:4,out=[];
  (sales||[]).forEach(s=>{
    if(!s||s.cancelled||s.goodwill||!ownsCode(party,s.customer)||!(txOwed(s)>0))return;
    const held=txHandSteps(s);
    if(!held.length||held.some(x=>!x.dated||!x.d))return;   /* an undated handover is skipped, a defaulted one too: it counts in no walk */
    const first=held[0].d,base={date:s.date||null,d:first};
    if(s.defaulted){out.push(Object.assign(base,{on:dayIso(dayNo(first)+lock),days:lock,open:false}));return;}
    const t=txDates(s);
    if(t.fullPaid&&t.pSrc==='stated'){out.push(Object.assign(base,{on:t.pOn,days:Math.max(0,dayNo(t.pOn)-dayNo(first)),open:false}));return;}
    if(t.fullPaid&&t.pSrc==='trail'){
      const p=txPrice(s),steps=(s.amend||[]).filter(a=>a&&+a.cash>0.0001).map(a=>({d:String(a.date||s.date),rm:+a.cash}));
      const first$=txPaid(s)-steps.reduce((a,x)=>a+x.rm,0),pays=(first$>0.009?[{d:String(s.date),rm:first$}]:[]).concat(steps)
        .sort((a,b)=>a.d.localeCompare(b.d));
      let days=0,cum=0,paid=0,i=0;
      for(const x of held){
        cum+=x.u*p;
        while(i<pays.length&&paid<cum-0.009){paid+=pays[i].rm;i++;}
        const by=paid>=cum-0.009&&i>0?pays[i-1].d:t.pOn;
        days=Math.max(days,dayNo(by)-dayNo(x.d));
      }
      out.push(Object.assign(base,{on:t.pOn,days:Math.max(0,days),open:false}));return;
    }
    if(txAdvance(s)>0.009){
      const since=txUnpaidSince(s);if(!since)return;
      const days=dayNo(today)-dayNo(since);
      if(days>term)out.push(Object.assign(base,{on:String(today).slice(0,10),days,open:true}));
    }
  });
  return out;
}
/* THE LATE PAYER'S OFFER, walked over those delays by the day each was settled (a delay before a prompt payment on the
   same day). On time is paid within the term (RULES.holdDays, his answer); a short delay is past it and under the lock
   (RULES.lockDays), a long one the lock or more. It turns on at one long delay, or at a second short delay within
   RULES.lateWindowDays of the one before; one payment on time turns it off. Within the window after that, any delay turns
   it on again, and then it takes RULES.lateResetRepeat payments on time in a row. It OFFERS a level down; it prices
   nothing (his answer of 29 Sep 2026). `late` and `run` are V5b2c's reading of the same walk, for PREPAY after lateness:
   whether any delay is in the history, and how many payments on time follow the last. */
function lateOffer(delays,rules){
  const R=rules||{},term=R.holdDays!=null?+R.holdDays:1,lock=R.lockDays!=null?+R.lockDays:4,
    win=R.lateWindowDays!=null?+R.lateWindowDays:90,rep=R.lateResetRepeat!=null?+R.lateResetRepeat:3;
  const kind=x=>x.days<=term?'prompt':x.days>=lock?'long':'short';
  const ev=(delays||[]).map(x=>Object.assign({k:kind(x)},x))
    .sort((a,b)=>String(a.on).localeCompare(String(b.on))||(a.k==='prompt')-(b.k==='prompt')||String(a.d).localeCompare(String(b.d)));
  let on=false,need=0,streak=0,why=null,last=null,resetOn=null,lastShort=null,everLate=false,run=0;
  for(const e of ev){
    const n=dayNo(e.on);
    if(e.k==='prompt')run++;else{everLate=true;run=0;}
    if(on){
      if(e.k==='prompt'){if(++streak>=need){on=false;resetOn=n;lastShort=null;streak=0;}}
      else{streak=0;last=e;}
      continue;
    }
    if(e.k==='prompt')continue;
    if(resetOn!=null&&n-resetOn<=win){on=true;need=rep;why='repeat';}
    else if(e.k==='long'){on=true;need=1;why='long';}
    else if(lastShort!=null&&n-lastShort<=win){on=true;need=1;why='shorts';}
    else{lastShort=n;continue;}
    last=e;streak=0;lastShort=null;
  }
  return on?{on:true,need,streak,why,days:last.days,open:!!last.open,since:last.on,late:everLate,run}:{on:false,late:everLate,run};
}
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
  const owedT=txOwed(t);   /* v741: the goods and the delivery together, as ledgerRow has read since v738 */
  const payFull=t.unpriced?false:(owedT<=0.009?true:(paid>=owedT-0.009)), payNone=paid<=0.009, delFull=t.qty>0&&del>=t.qty-0.009, delNone=del<=0.009;
  const pay=t.unpriced?'Unpriced':payFull?'Paid':payNone?'Unpaid':'Partial';
  const deliv=delFull?'Delivered':delNone?'Undelivered':'Partial';
  let order=(payFull&&delFull)?'Completed':(payNone&&delNone)?'Pending':'Open';
  if(order==='Open'){                                                  // split Open the same way the replay does
    const paidFrac=owedT>0?paid/owedT:0,delivFrac=t.qty>0?del/t.qty:0;
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
  const owedS=txOwed(s);   /* v741: paid in full is the goods and the delivery */
  const full=s.qty>0&&eff>=s.qty-0.01, fullPaid=owedS>0&&paid>=owedS-0.01;
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
   through it. SINCE v634 THE DEFAULT IS WRITTEN OFF (his instruction, 14 Sep 2026): txAdvance reads
   nothing owed on a defaulted sale, so it reaches no receivable at all, and txWrittenOff carries
   the figure to what was lost (the P&L, the month's charge, the bad-debt rate, the party's quote).
   The rate still answers 1 for a caller that hands it the row. The supplier readers keep calling
   provRate directly: that side has its own rule and its own record. */
/* V5, HIS ANSWERS OF 29 SEP 2026: A SALE'S LADDER IS ITS OWN AND COUNTS FROM THE HANDOVER. Nothing on the handover day,
   then 25%, 50% and 75% a day, and all of it from the fourth day, the day the Counter locks the account. The day is the
   one the goods still unpaid were collected or delivered (txUnpaidSince), the order date only for a row that names none.
   The supplier side keeps provRate above. */
const SALE_FULL_DAYS=4;
function saleLadder(days){return days>=SALE_FULL_DAYS?1:days>=3?0.75:days>=2?0.5:days>=1?0.25:0;}
function saleProvSince(s){return (s&&(txUnpaidSince(s)||s.date))||null;}
function saleProvRate(s,days){return (s&&s.defaulted)?1:saleLadder(days);}
/* ============ WHAT THE INVENTORY IS CARRIED AT (26 Sep 2026, his instruction) ============
   "Derive the oil stock cost from the lots", then "derive salt's stock cost from the lots too and all
   of the products". Every book's inventory rate is DERIVED here and nothing typed remains: salt's
   STOCK_COST and oil's PROD_STOCK_COST were rolled by hand or by the fold, lot by lot, and both fell
   behind the book (oil's at v384, salt's at RM48 while three lots landed over it).
   THE METHOD IS THE ONE EVERY ROLL USED, now written once. Units leave oldest first (FIFO), so the
   units on hand are the NEWEST ones: the stock (counted where a count stands, else the walk, the
   walk's own currentStock) is allocated newest-first onto the book's received lots, and the rate is
   the units-weighted rate of those allocations. A lot is live and received (poLive, poRecvUnits):
   pending, defaulted, cancelled and in-transit units hold no stock. The rate is the GOODS rate,
   poRate, the total over the quantity bought; freight is left out because every reader adds it
   separately (Financials' "before freight in", freightPerUnit on the IAS 2 line). Stock beyond
   every lot sits on the opening at its costPerKg; where the opening has no cost those units are
   left out of the weighting rather than valued at nothing. At or under nought there is nothing to
   weigh, so the rate is the newest received lot's, else the opening's, else null (the caller's
   fallback). lotOutlook's allocation is this one: lotAlloc is what it walks. Rounded to 4 places,
   the precision the pricing snapshot carries. */
function lotAlloc(purchases,stock){
  const lots=(purchases||[]).filter(p=>poLive(p)&&poRecvUnits(p)>0.0001)
    .map(p=>({p:p,recv:poRecvUnits(p),date:p.receivedOn||p.date}))
    .sort((a,b)=>{const x=a.date,y=b.date;if(!x||!y)return (!x&&!y)?0:(!x?1:-1);return x<y?-1:x>y?1:0;});
  let inv=+stock||0;
  for(let i=lots.length-1;i>=0;i--){const left=+Math.min(lots[i].recv,Math.max(0,inv)).toFixed(2);inv-=left;lots[i].left=left;}
  return {lots:lots,beyond:Math.max(0,+inv.toFixed(2))};
}
function stockBasis(purchases,stock,opening){
  const A=lotAlloc(purchases,stock), op=opening||{};
  const opRate=(op.costPerKg!=null&&Number.isFinite(+op.costPerKg))?+op.costPerKg:null;
  const parts=A.lots.filter(l=>l.left>0.0001).map(l=>({rid:l.p.rid||null,date:l.date,units:l.left,rate:poRate(l.p)}));
  let units=0,rm=0;
  parts.forEach(x=>{units+=x.units;rm+=x.units*x.rate;});
  if(A.beyond>0.0001&&opRate!=null){units+=A.beyond;rm+=A.beyond*opRate;}
  const newest=A.lots.length?poRate(A.lots[A.lots.length-1].p):null;
  const rate=units>0.0001?rm/units:(newest!=null?newest:opRate);
  return {rate:rate==null?null:+rate.toFixed(4),parts:parts,onOpening:A.beyond,openingRate:opRate,
    from:units>0.0001?'lots':(newest!=null?'newest lot':(opRate!=null?'opening':null))};
}
/* COGS A UNIT, HIS SETTLED RULE OF 05 OCT 2026 (salt first; oil, candy and rice to follow): the LATEST purchase entry's
   quote total plus its trip freight, over its units. Not the shelf's weighted goods rate (stockBasis above, which is
   what the inventory is CARRIED at and leaves freight out), not a trailing average, and no leakage. The caller passes one
   book's lots. A lot counts once something of it has landed (poLive, poRecvUnits), on its receivedOn else its date; with
   `onOrBefore`, a lot landing after that day is not yet the latest. On one day the lot later in the list wins, so a lot
   appended after the book (a drafted one) is the newer. The row itself comes back as `p` for its caller to name. */
function latestCogs(purchases,onOrBefore){
  let best=null;
  (purchases||[]).forEach(p=>{
    if(!p||!poLive(p)||!(poRecvUnits(p)>0.0001)||!(+p.qty>0)||!Number.isFinite(+p.total))return;
    const d=p.receivedOn||p.date||null;
    if(onOrBefore&&d&&d>onOrBefore)return;
    if(!best||(d||'')>=(best.date||''))best={p:p,date:d};
  });
  if(!best)return null;
  const p=best.p, fr=Number.isFinite(+p.freight)?+p.freight:0;
  return {p:p,rid:p.rid||null,date:best.date,quote:+p.total,freight:fr,units:+p.qty,rate:+((+p.total+fr)/+p.qty).toFixed(4)};
}
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
  /* 26 Sep 2026: what the inventory is carried at, derived from this book's lots and this stock. A book
     with no received lot and no opening cost has nothing to weigh, and takes the fallback the desk has
     always given it, this book's own weighted buying rate, which is 0 for such a book. */
  W.stockBasis=stockBasis(_B,W.currentStock,_op);
  W.stockCost=W.stockBasis.rate!=null?W.stockBasis.rate:W.wavgBuy;
  W.revTotal=W.pricedSales.reduce((a,s)=>a+(s.total||0)-txPendRM(s),0);   // net of any pending tail on a part-moved order
  W.revCollected=_S.reduce((a,s)=>a+(s.cash||0),0);
  /* AR = advance only: pending unpaid-and-undelivered is not a receivable */
  W.arList=_S.filter(s=>txAdvance(s)>0.009);
  W.arGross=W.arList.reduce((a,s)=>a+txAdvance(s),0);
  W.ar=Math.max(0,+W.arList.reduce((a,s)=>a+txAdvance(s)*(1-saleProvRate(s,dage(saleProvSince(s)))),0).toFixed(2)); // net of provisioning, aged from the handover (V5); a written-off default is not on the list
  W.advTotal=W.arGross;
  W.writtenOffRM=+_S.reduce((a,s)=>a+txWrittenOff(s),0).toFixed(2);   // v634: off the receivables, still a loss
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
/* ============ RESTOCK FROM MEASURED DEMAND (his instruction of 24 Sep 2026) ============
   "What is the typical buy size, so I can plan to restock properly, as inefficient inventory is also
   as costly." Then: coverage dynamic, every trend and forecast off measured data points, and the
   reorder point on the same footing, never more than two weeks and never less than four days.
   ONE BOOK AT A TIME, EVERY INPUT MEASURED, and the desk gathers them (restockFor in the master):
     rows      the book's demand rows {date, qty}: priced, not cancelled, not a reward
     today     the desk's clock; free is on hand less what is owed out, as coverStats reads it
     tiers     the supplier's quote [{qty, total}]; leakPct the book's measured leak per lot
     rhythm    {dow:[7], pay, mid}, the Whiteboard's factors, already shrunk; payWin its pay window
     dues      [{date, units}] a named customer's usual lot on the day their own cadence says
     holidays  iso -> name; holVerifiedTo where that table stops
     leadDays  order to receipt, median; reviewDays the median gap between his lots (null: not measured)
   THE FORECAST is base x trend x weekday x pay window for each day ahead. Base is the units a day,
   weighted by recency (half-life 14 days) over every calendar day of the book, silent ones included.
   Trend is the slope of weekly units over up to the last eight full weeks, pulled towards none by
   n/(n+8) and capped at 50% either way. A holiday in the window is flagged and moves nothing until
   one has been traded through, the Whiteboard's rule. Any window's demand is the run rate or what
   the named customers are due to take in it, whichever is more, and both are reported.
   THE REORDER POINT is lead days plus safety stock over the base rate, clamped to 4 and 14 days (his
   bound); safety is 1.65 sigma of the last 28 days' daily units, over the lead and review days.
   THE LOT is the cheapest to HOLD, not to buy: a tier's rate carries the leak for half the lot's cover,
   and a lot the forecast would not sell inside 28 days is overstock and is not offered.
   Every division is guarded to null, never NaN; a book with no demand returns {empty:true}. */
function restockPlan(S){
  const MS=86400000, today=(S.today instanceof Date)?S.today:new Date(S.today);
  const rows=(S.rows||[]).filter(r=>r&&r.date&&+r.qty>0);
  if(!rows.length)return {empty:true,n:0};
  const div=(a,b)=>(b&&isFinite(b)&&isFinite(a))?a/b:null;
  const r2=v=>v==null?null:+v.toFixed(2);
  const iso=d=>d.toISOString().slice(0,10);
  const ageOf=d=>Math.round((today-new Date(d))/MS);
  const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
  /* ---- buy size: what one order looks like ---- */
  const qs=rows.map(r=>+r.qty).sort((a,b)=>a-b), n=qs.length, tot=qs.reduce((a,x)=>a+x,0);
  const pct=p=>{const k=(n-1)*p,lo=Math.floor(k),hi=Math.ceil(k);return r2(qs[lo]+(qs[hi]-qs[lo])*(k-lo));};
  const cnt={};qs.forEach(q=>{cnt[q]=(cnt[q]||0)+1;});
  const common=Object.keys(cnt).map(q=>({qty:+q,n:cnt[q]})).sort((a,b)=>b.n-a.n||a.qty-b.qty).slice(0,3);
  const sUp=S.smallUpTo!=null?S.smallUpTo:1, bFrom=S.bigFrom!=null?S.bigFrom:3;
  const bandOf=q=>q<=sUp+0.0001?'small':(q>=bFrom-0.0001?'big':'mid');
  const bands={small:{orders:0,units:0},mid:{orders:0,units:0},big:{orders:0,units:0}};
  qs.forEach(q=>{const b=bands[bandOf(q)];b.orders++;b.units+=q;});
  Object.keys(bands).forEach(k=>{const b=bands[k];b.units=r2(b.units);
    b.orderShare=r2(div(b.orders,n));b.unitShare=r2(div(b.units,tot));});
  const buy={n:n,conf:n>=40?'measured':'thin',median:pct(0.5),p25:pct(0.25),p75:pct(0.75),p90:pct(0.9),
    mean:r2(div(tot,n)),common:common,bands:bands,smallUpTo:sUp,bigFrom:bFrom};
  /* ---- base: units a day, recency weighted over every calendar day ----
     A BOOK YOUNGER THAN 28 DAYS IS READ OVER 28, the days before its first order counted silent. Two
     candy orders in three days read over three days forecast 174 unit a month and asked for 150 unit;
     no 28-day forecast stands on fewer than 28 days. The trend is read off the book's real weeks only. */
  const first=rows.map(r=>r.date).sort()[0];
  const span=Math.max(1,ageOf(first)+1), bSpan=Math.max(span,28);
  const byAge=new Array(bSpan).fill(0);
  rows.forEach(r=>{const a=ageOf(r.date);if(a>=0&&a<bSpan)byAge[a]+=+r.qty;});
  let wS=0,uS=0;byAge.forEach((u,a)=>{const w=Math.pow(0.5,a/14);wS+=w;uS+=w*u;});
  const base=div(uS,wS)||0;
  /* ---- trend: weekly units over up to eight full weeks, today being part of none ---- */
  const nW=Math.min(8,Math.floor((span-1)/7)), wk=[];
  for(let j=nW-1;j>=0;j--){let s=0;for(let a=1+7*j;a<=7+7*j;a++)s+=byAge[a]||0;wk.push(s);}
  let trendRaw=null,trend=0;
  if(nW>=2){
    const mx=(nW-1)/2, my=wk.reduce((a,x)=>a+x,0)/nW;
    let sxy=0,sxx=0;wk.forEach((y,x)=>{sxy+=(x-mx)*(y-my);sxx+=(x-mx)*(x-mx);});
    const rel=div(div(sxy,sxx),my);
    if(rel!=null){trendRaw=+rel.toFixed(4);trend=+clamp(rel*nW/(nW+8),-0.5,0.5).toFixed(4);}
  }
  /* ---- volatility: daily units over the last 28 days ---- */
  const last=byAge.slice(0,28), lm=last.reduce((a,x)=>a+x,0)/last.length;
  const sigma=last.length>1?Math.sqrt(last.reduce((a,x)=>a+(x-lm)*(x-lm),0)/(last.length-1)):0;
  const lead=Math.max(1,+S.leadDays||0);
  const reviewMeasured=S.reviewDays!=null&&+S.reviewDays>0;
  const review=reviewMeasured?+S.reviewDays:14;
  /* ---- the daily forecast ---- */
  const H=Math.max(28,Math.ceil(14+review)), R=S.rhythm||null, pw=S.payWin||(()=>false), hol=S.holidays||{};
  const days=[];
  for(let i=1;i<=H;i++){
    const dt=new Date(today.getTime()+i*MS), d=iso(dt);
    const fD=R&&R.dow&&R.dow[dt.getUTCDay()]!=null?R.dow[dt.getUTCDay()]:1;
    const fP=R?(pw(dt)?(R.pay!=null?R.pay:1):(R.mid!=null?R.mid:1)):1;
    const fT=clamp(1+trend*i/7,0.5,1.5);
    days.push({iso:d,units:base*fT*fD*fP,hol:hol[d]||null});
  }
  const dues=(S.dues||[]).filter(x=>x&&x.date&&+x.units>0)
    .map(x=>({date:x.date,units:+x.units,id:x.id||null,off:Math.max(1,-ageOf(x.date))}));
  const run=(a,b)=>days.reduce((s,d,k)=>s+d.units*Math.max(0,Math.min(k+1,b)-Math.max(k,a)),0);
  const named=(a,b)=>dues.filter(x=>x.off>a&&x.off<=b).reduce((s,x)=>s+x.units,0);
  const demand=(a,b)=>{const r=run(a,b),m=named(a,b);return {run:r2(r),named:r2(m),use:r2(Math.max(r,m)),by:m>r?'named':'run'};};
  /* ---- the reorder point ---- */
  const safety=1.65*sigma*Math.sqrt(lead+review);
  const cover=div(safety,base);
  const rawDays=cover==null?14:lead+cover;
  const rDays=+clamp(rawDays,4,14).toFixed(1);
  const bound=rawDays<4?'floor':(rawDays>14?'ceiling':null);
  const reorderUnits=demand(0,rDays).use;
  const free=+(+S.free||0).toFixed(2);
  /* ---- when the free inventory reaches the reorder point, and when it runs out, on the run rate ---- */
  const reach=lvl=>{if(free<=lvl+1e-9)return 0;let c=0;
    for(let k=0;k<days.length;k++){const u=days[k].units;if(free-(c+u)<=lvl+1e-9)return +(k+div(free-lvl-c,u)).toFixed(1);c+=u;}
    return null;};
  const reachD=reach(reorderUnits), coverD=reach(0);
  const dayISO=d=>d==null?null:iso(new Date(today.getTime()+Math.ceil(d)*MS));
  /* ---- the lot ---- */
  const need=r2(Math.max(0,reorderUnits+demand(rDays,rDays+review).use-free));
  const d28=demand(0,28), perDay=div(d28.use,28);
  const leakDay=div((+S.leakPct||0)/100,review)||0;
  const price=(q,t)=>{const rate=t.total/t.qty, cov=div(q,perDay);
    return {qty:r2(q),total:r2(rate*q),rate:r2(rate),lots:Math.round(q/t.qty),tier:t.qty,cover:cov==null?null:+cov.toFixed(1),
      score:+(rate*(1+leakDay*(cov==null?0:cov/2))).toFixed(4)};};
  const tiers=(S.tiers||[]).filter(t=>t&&+t.qty>0&&+t.total>0).map(t=>({qty:+t.qty,total:+t.total})).sort((a,b)=>a.qty-b.qty);
  const cands=[];
  tiers.forEach(t=>{for(let k=1;k<=1000;k++){const q=k*t.qty;if(q>d28.use+1e-9)break;if(q>=need-1e-9)cands.push(price(q,t));}});
  /* v825: A LOT MAY MIX TIERS. Oil needed 53 unit under a 90 unit cap and was offered 6 x 10 unit for RM 600 when 50 + 10 is
     RM 480: one tier's multiples were the only candidates. Every mix of two or more tiers inside the cap is scored the same way,
     at its blended rate; `mix` lists it, largest tier first, and `tier` is the largest. */
  if(tiers.length>1){
    const cnt=new Array(tiers.length).fill(0);let seen=0;
    const walkMix=(i,q,tot)=>{if(++seen>50000)return;
      if(i===tiers.length){if(q>=need-1e-9&&cnt.filter(n=>n>0).length>1){const cov=div(q,perDay),rate=tot/q;
          cands.push({qty:r2(q),total:r2(tot),rate:r2(rate),lots:cnt.reduce((a,n)=>a+n,0),tier:tiers[cnt.map((n,k)=>n>0?k:-1).filter(k=>k>=0).pop()].qty,
            mix:tiers.map((t,k)=>({tier:t.qty,n:cnt[k]})).filter(x=>x.n>0).reverse(),cover:cov==null?null:+cov.toFixed(1),
            score:+(rate*(1+leakDay*(cov==null?0:cov/2))).toFixed(4)});}return;}
      for(let n=0;q+n*tiers[i].qty<=d28.use+1e-9;n++){cnt[i]=n;walkMix(i+1,q+n*tiers[i].qty,tot+n*tiers[i].total);}cnt[i]=0;};
    walkMix(0,0,0);
  }
  const best=l=>l.slice().sort((a,b)=>a.score-b.score||a.qty-b.qty)[0]||null;
  const smallest=t=>price(Math.max(1,Math.ceil((need-1e-9)/t.qty))*t.qty,t);
  let lot=best(cands);
  /* nothing fits under the 28-day cap: the smallest lot that covers the need, marked as overstock */
  if(!lot&&tiers.length){lot=tiers.map(smallest).sort((a,b)=>a.qty-b.qty||a.rate-b.rate)[0];lot.overstock=true;}
  /* THE NEXT PRICE BREAK: a cheaper tier than the chosen lot's, and why it lost; or, where the lot is
     itself on a cheaper tier than the highest rate, the break it took and why it won */
  let next=null;
  if(lot){
    const cheaper=tiers.filter(t=>t.total/t.qty<lot.rate-0.005).sort((a,b)=>b.total/b.qty-a.total/a.qty)[0];
    if(cheaper){
      const alt=best(cands.filter(c=>c.tier===cheaper.qty&&!c.mix))||smallest(cheaper);
      next=Object.assign(alt,{won:false,why:alt.qty>d28.use+1e-9?'overstock':'leak'});
    }else{
      const pricier=tiers.filter(t=>t.total/t.qty>lot.rate+0.005).sort((a,b)=>a.total/a.qty-b.total/b.qty)[0];
      if(pricier){const alt=best(cands.filter(c=>c.tier===pricier.qty&&!c.mix))||smallest(pricier);
        next=Object.assign({},lot,{won:true,why:'rate',over:alt});}
    }
  }
  return {empty:false,n:n,conf:buy.conf,buy:buy,
    base:r2(base),days:span,young:span<28,trend:trend,trendRaw:trendRaw,weeks:nW,sigma:r2(sigma),lead:lead,review:review,reviewMeasured:reviewMeasured,
    forecast:{d7:demand(0,7),d14:demand(0,14),d28:d28},
    reorder:{days:rDays,rawDays:+rawDays.toFixed(1),bound:bound,units:reorderUnits,safety:r2(safety),min:4,max:14},
    free:free,coverDays:coverD,coverDate:dayISO(coverD),reachDays:reachD,reachDate:dayISO(reachD),below:free<=reorderUnits+1e-9,
    need:need,lot:lot,next:next,leakPct:+(+S.leakPct||0),dues:dues.filter(x=>x.off<=H),
    hols:days.filter(d=>d.hol).map(d=>({iso:d.iso,name:d.hol})),
    pastTable:S.holVerifiedTo?iso(new Date(today.getTime()+28*MS))>S.holVerifiedTo:false};
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
  const oweRM=t.cancelled?0:+Math.max(0,(buy?tot:txOwed(t))-paidRM).toFixed(2);      // money still to be handed over: on a sale the goods and the delivery together (v738)
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
  if(!buy&&+t.delivery>0) r.dv=+(+t.delivery).toFixed(2);   // v738: the delivery beside the goods, so the phone can say what is owed
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
     one figure the phone app's leak gate banned outright. `note` is prose that quotes lot costs and
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
/* ====== THE SAME MONEY BY TWO ROADS (28 Sep 2026, s210) =========================================
   s210 was paid RM 210 against the account, received at 13:08 on 27 Sep and folded as v902, and RM 210
   cash at the counter on the same order a minute later, folded as v903 onto the row the first had
   settled: cash 420 on RM 210, read Completed, the second RM 210 nowhere. Both drafts were measured on
   the row at RM 0 paid and said it settled the order; nobody saw the RM 420. This refuses a payment
   the drafter MEASURED BEFORE OTHER MONEY REACHED ITS ROW, which would now take the row past what it
   owes. `drafted` is the row's paid figure the draft was measured on (the drafted row's `cash`, which
   is ledgerRow's txPaid or poCash). A payment drafted on the row as it stands, flagged past what it
   owes and approved, is his decision and folds as it always has; with no `drafted` (a hand-written
   batch) it measures nothing. A ceiling, not a reader of what is owed: txAdvance stays that. A sale
   owes the goods and the delivery less what was paid, cash and in kind; a lot owes its total less
   poCash, a pending lot having paid nothing; an unpriced row has no figure to be past. ONE RULE, read
   by the fold's plan on the row as its batch leaves it and by applyAmend. */
function payFault(row,cash,isSale,drafted){
  const c=+cash||0;
  if(!(c>0.009)||!row||row.unpriced||drafted==null||!isFinite(+drafted))return '';
  const paid=isSale?txPaid(row):poCash(row),owed=isSale?txOwed(row):(+row.total||0),since=+(paid-(+drafted)).toFixed(2);
  if(!(since>0.009)||paid+c<=owed+0.009)return '';
  return 'RM '+since+' reached this row after the payment was measured (RM '+(+(+drafted).toFixed(2))+' paid then, RM '+(+paid.toFixed(2))+' now), so RM '
    +(+c.toFixed(2))+' more would take it RM '+(+(paid+c-owed).toFixed(2))+' past the RM '+(+(+owed).toFixed(2))+' it owes: the same money booked by two roads is a judgement, left for a person';
}
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
/* THE ORDER KEY IS WHAT THE CUSTOMER AGREED TO PAY, goods and carriage together, and it stays that
   way through the split of 19 Sep 2026 (v694 names a row by this to the character, and it is
   written onto a LIVE order at acknowledgement, so a key that moved would orphan every order in
   flight). It is also what stops a collision: on the goods alone, s155 and s157 both become
   CN6-WM-R|2026-09-12|110, and four of the thirteen carriage-bearing rows are still open. */
/* V4a (28 Sep 2026): AND IT NAMES THE PRODUCT, ON EVERY BOOK BUT SALT. A salt sale and a candy sale to one party on one
   day for one figure were one key (s190 and s191), and two lines of one order sheet acknowledged together would be too:
   findRow refuses a key that names two rows, so every later stage of both would stick. Salt's keys predate products, and
   a salt row carries no product while an order or an entry names salt, so salt takes no tail whether or not it is named:
   every salt key, on the book and on a live order, is what it was to the character, and any other product's key is that
   and `|product`. KEY_PLAIN is the one product this engine names, for this alone; a new book needs nothing here.
   keyTail is the one place the tail is spelt; ovRekey gives a key written before V4a its tail and changes nothing else. */
const KEY_PLAIN='salt';
function keyTail(product){return product&&product!==KEY_PLAIN?'|'+product:'';}
function ovKey(t){return (t.customer||t.supplier)+'|'+t.date+'|'+((+t.total||0)+(+t.delivery||0))+keyTail(t.product);}
function ovRekey(key,product){return typeof key==='string'&&key.split('|').length===3?key+keyTail(product):key;}
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
/* V5b2 (his answers of 29 Sep 2026): WHAT A PARTY OWES AT ONCE, across every book, their bucket included: each row's goods
   and delivery less what is paid. A gift, a write-off or a cancelled row owes nothing; everything else counts until it is
   paid, an order paid in advance included, and so does an agreed row dated ahead (a pending order). A row with no
   figure counts nought. Against RULES.creditCeilingRM it decides an order paid in advance. */
function partyOwedRM(sales,party){return +(sales||[]).filter(s=>s&&ownsCode(party,s.customer)&&!s.cancelled&&!s.goodwill&&!s.defaulted)
  .reduce((a,s)=>a+Math.max(0,txOwed(s)-txPaid(s)),0).toFixed(2);}
/* S6 11.15 (his decision D7 of 24 Sep 2026): A PAYMENT AGAINST THE ACCOUNT, OLDEST FIRST. What a customer says they sent
   against the account settles the rows they owe on as the statement's To pay now lists them: every row of theirs or their
   bucket with goods out and money owed (txAdvance; a gift or a write-off owes nothing), by the order date, undated last.
   Each row takes what it owes or what is left of the figure; what no row owes is `left`. The desk draws this and nothing
   else, so the rows his one tap approves are the engine's.
   28 SEP 2026, HIS INSTRUCTION (pay terms V2): AN ORDER AT READY IS DUE AT ONCE. `ready` names, by ovKey, the rows whose site
   orders he has made Ready. Such a row owes all that is left on it (the goods and the delivery less what was paid), not
   only the goods handed over: with goods out it takes its place among the rows with goods out, oldest first; with nothing
   handed over it comes after all of them, oldest first. A cancelled or written-off row is never Ready. Without `ready` the
   allocation is as it was, so the rows are settled as the statement's To pay now lists them. */
function claimAlloc(sales,party,amount,ready){
  const rd=new Set(ready||[]),isRd=s=>rd.size>0&&!s.cancelled&&!s.defaulted&&rd.has(ovKey(s));
  const owes=s=>isRd(s)?Math.max(0,txOwed(s)-txPaid(s)):txAdvance(s),out1=s=>!isRd(s)||(s.deliveredQty||0)>0.0001;
  const byDate=(a,b)=>String(a.date||'9999').localeCompare(String(b.date||'9999'));
  const mine=(sales||[]).filter(s=>s&&ownsCode(party,s.customer)&&!s.goodwill&&owes(s)>0.009);
  const rows=mine.filter(out1).sort(byDate).concat(mine.filter(s=>!out1(s)).sort(byDate));
  let left=+(+amount||0).toFixed(2);const out=[];
  for(const s of rows){if(left<=0.004)break;const owed=+owes(s).toFixed(2),take=+Math.min(left,owed).toFixed(2);
    out.push({key:ovKey(s),rid:s.rid||null,party:s.customer,date:s.date||null,owed:owed,rm:take});left=+(left-take).toFixed(2);}
  return {rows:out,left:Math.max(0,left)};
}
/* 05 OCT 2026, HIS DESIGN: ONE DELIVERY FOR A TRIP OF SEVERAL BOOKS. The rows one trip carries to one customer on one day
   share `trip`, an id the desk mints at entry; the delivery stays on ONE of them, so txOwed, every reading of what is owed
   and every statement read the charge once, as they did when the four earlier trips were folded by hand. A trip refuses a
   second delivery, a second customer, a second date and a book twice. A lone row of a trip is no fault: it is today's
   convention, and its siblings may still be waiting. */
const TRIP_RE=/^t[0-9]{6,16}$/;
function tripRows(sales,s){return s&&s.trip?(sales||[]).filter(x=>x&&x.trip===s.trip&&!x.cancelled):[];}
function tripFault(rows){
  const R=(rows||[]).filter(x=>x&&x.trip&&!x.cancelled);if(!R.length)return null;
  const id=R[0].trip;
  if(R.some(x=>!TRIP_RE.test(String(x.trip))))return 'the trip id is not one the desk mints';
  if(R.some(x=>x.trip!==id))return 'these rows name more than one trip';
  if(new Set(R.map(x=>x.customer)).size>1)return 'trip '+id+' names more than one customer, and a trip is one customer\'s';
  if(new Set(R.map(x=>x.date||null)).size>1)return 'trip '+id+' spans more than one date, and a trip is one day\'s';
  if(new Set(R.map(x=>x.product||'salt')).size<R.length)return 'trip '+id+' names a book twice, and a trip carries one row a book';
  const dv=R.filter(x=>+x.delivery>0.005).length;
  if(dv>1)return 'trip '+id+' carries a delivery on '+dv+' rows: one trip, one delivery, on one row';
  return null;
}
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
/* ====== v628, AMEND ID: A RENAME IS A RE-KEY (his rulings of 11 Sep 2026) =========================
   A code is the party's one identifier, the string the ledger carries, so a new name or place that
   derives a new code moves the code wherever the book holds it: every whole value and every key that
   is the code. The codes built on it move with it, the -R account and an end buyer's
   <code>-<n>-<place>, because ownerCode reads the party back out of them. Prose is never touched: a
   note naming the old code says what was true when it was written. ONE WRITER for the drafter's
   count, the fold's apply and the phone's preview. */
function renamePairs(roster,from,to){
  return (roster||[]).filter(c=>c===from||c.indexOf(from+'-')===0).map(c=>[c,to+c.slice(from.length)]);
}
/* ====== v633: A PLACE AS IT IS TYPED, AND AS IT IS LOOKED UP (his decision of 14 Sep 2026) =========================
   Add ID and Amend ID find a party's place on the map from what is typed, with no step of his. ONE SPELLING RULE for
   tools/gazfetch.mjs, which hashes the place list, and for the phone, which hashes what is typed: lower case, accents off,
   punctuation to spaces, and the abbreviations people write expanded. The candidates run from the whole place to its
   parts to runs of its words, longest first, so "Taman X, Town" tries itself, then X, then the town. */
const PLACE_ABBR={kg:'kampung',kpg:'kampung',tmn:'taman',bdr:'bandar',jln:'jalan',sg:'sungai',sgi:'sungai',bt:'batu',bkt:'bukit',sri:'seri',pj:'petaling jaya',kl:'kuala lumpur'};
const PLACE_GENERIC=['taman','kampung','bandar','jalan','pekan','mukim','seksyen','section','baru'];
function placeKey(s){
  return String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
    .split(' ').filter(Boolean).map(w=>PLACE_ABBR[w]||w).join(' ');
}
function placeBare(k){const w=k.split(' ');while(w.length>1&&PLACE_GENERIC.indexOf(w[0])>=0)w.shift();return w.join(' ');}
function placeCandidates(s){
  const out=[],add=k=>{if(k&&k.length>=3&&out.indexOf(k)<0)out.push(k);};
  const whole=placeKey(s);add(whole);add(placeBare(whole));
  String(s==null?'':s).split(',').forEach(p=>{const k=placeKey(p);add(k);add(placeBare(k));});
  const w=whole.split(' ');
  for(let len=Math.min(4,w.length);len>=1;len--)for(let i=0;i+len<=w.length;i++){const run=w.slice(i,i+len).join(' ');if((len>1||run.length>=6)&&run.split(' ').some(x=>PLACE_GENERIC.indexOf(x)<0))add(run);}
  return out;
}
function vaultRekeyMap(map,from,to){
  if(from===to)return map;
  const next={...map};
  Object.keys(map).filter(code=>code===from||code.startsWith(from+'-')).forEach(code=>{
    const target=to+code.slice(from.length);
    if(Object.hasOwn(map,target))throw new Error('The new code already holds a vault entry. Resolve it on Desk first.');
    next[target]=map[code];delete next[code];
  });
  return next;
}
function vaultPendingOk(record,publicWord=()=>false){
  const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const envelope=v=>object(v)&&Object.keys(v).every(k=>['v','salt','iv','ct','it'].includes(k))
    &&v.v===1&&['salt','iv','ct'].every(k=>typeof v[k]==='string'&&/^[A-Za-z0-9+/]+={0,2}$/.test(v[k]));
  const pair=v=>object(v)&&Object.keys(v).every(k=>['names','places'].includes(k))
    &&envelope(v.names)&&(v.places===null||envelope(v.places));
  const fields=['at','expectedRevision','names','places','pair','code','kind','parent','geo','tiers','vault','addrVault',
    'from','to','product','party','date','qty','total','cash','delivery','freight','hand','deliveredQty','receivedQty',
    'stream','associate','assoc','downstream','trip','level','tier','form','direction','amount','loan','rid','movedUnits','fields','sameDay','handover',
    'cost','settledRM','settledKg','rebateKg','coverUnits','coverRM','agreedOn','paidOn','deliveredOn','receivedOn',
    'cancelledOn','unpriced','cancelled','pending','inTransit','defaulted','rebate','goodwill'];
  const enumWords=['customer','supplier','reseller','referral','downstream','bucket','cash','goods','in','out',
    'SELL','BUY','Correction','Fulfilment','Cancellation','R1','R2','R3','salt','oil','candy','rice','spare','delivered','collected',
    'Ambassador','Titanium','Platinum','Gold','Silver','A','T1','T2','T3','T4','small','mid','big'];
  const safe=(v,key)=>{
    if(v===null||typeof v==='boolean')return true;
    if(typeof v==='number')return Number.isFinite(v);
    if(['vault','addrVault','names'].includes(key))return envelope(v);
    if(key==='places'&&envelope(v))return true;
    if(typeof v==='string')return ['rid','loan'].includes(key)&&/^[a-z][a-z0-9-]{0,60}$/.test(v)
      ||enumWords.includes(v)||/^[CS][A-Z0-9]+-[A-Z0-9]+(?:-[A-Za-z0-9]+)*$/.test(v)
      ||/^\d{4}-\d\d-\d\d(?:T[\d:.]+Z)?$/.test(v)||/^[a-z][0-9]+$/.test(v);
    if(Array.isArray(v))return v.length<=3&&v.every((n,i)=>typeof n==='number'&&Number.isFinite(n)
      ||i===2&&typeof n==='string'&&publicWord(n));
    return object(v)&&Object.entries(v).every(([k,n])=>
      (fields.includes(k)||enumWords.includes(k)||/^[CS][A-Z0-9]+-[A-Z0-9]+(?:-[A-Za-z0-9]+)*$/.test(k))&&safe(n,k));
  };
  if(!object(record)||Object.keys(record).some(k=>!['path','body','base','desired','input'].includes(k))
    ||typeof record.path!=='string'||!/^\/?((all\/maker\/inputs|vault\/inputs)\/(add-id|amend-id|place|stock-count|sale|purchase|tier-set|loan|repay|gift|redeem|ledger-amend)|vault\/pair)$/.test(record.path)
    ||!object(record.body)||!safe(record.body,'body'))return false;
  if(record.base!==undefined&&!pair(record.base)||record.desired!==undefined&&!pair(record.desired))return false;
  if(record.input!=null&&(!object(record.input)||Object.keys(record.input).some(k=>!['operation','body'].includes(k))
    ||!['add-id','amend-id','place'].includes(record.input.operation)||!safe(record.input.body,'body')))return false;
  return true;
}
function vaultMapMerge(base,intended,latest,reviewed=[]){
  const clone=value=>JSON.parse(JSON.stringify(value));
  const stable=value=>{
    if(Array.isArray(value))return value.map(stable);
    if(value&&typeof value==='object')
      return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
    return value;
  };
  const same=(left,right)=>JSON.stringify(stable(left))===JSON.stringify(stable(right));
  const result=clone(latest),conflicts=[];
  const changed=[...new Set([...Object.keys(base),...Object.keys(intended)])].filter(key=>
    Object.hasOwn(base,key)!==Object.hasOwn(intended,key)||!same(base[key],intended[key]));
  for(const key of changed){
    const localGone=!Object.hasOwn(intended,key),latestGone=!Object.hasOwn(latest,key);
    const remoteChanged=Object.hasOwn(base,key)!==Object.hasOwn(latest,key)||!same(base[key],latest[key]);
    const alreadyDesired=localGone===latestGone&&same(intended[key],latest[key]);
    if(remoteChanged&&!alreadyDesired&&!reviewed.includes(key)){conflicts.push(key);continue;}
    if(localGone)delete result[key];
    else Object.defineProperty(result,key,{value:clone(intended[key]),enumerable:true,writable:true,configurable:true});
  }
  return {map:result,conflicts,changed};
}
function renameInBook(book,pairs){
  const map=new Map(pairs);let n=0;
  const walk=v=>{
    if(!v||typeof v!=='object')return;
    for(const k of Object.keys(v)){
      if(typeof v[k]==='string'&&map.has(v[k])){v[k]=map.get(v[k]);n++;}else walk(v[k]);
      if(!Array.isArray(v)&&map.has(k)){v[map.get(k)]=v[k];delete v[k];n++;}
    }
  };
  walk(book);return n;
}

return {ledgerAmendmentEntry:ledgerAmendmentEntry,inputConsumesResource:inputConsumesResource,inputResource:inputResource,rewardAccount:rewardAccount,entryReservationFault:entryReservationFault,rewardMargin:rewardMargin,rewardUnits:rewardUnits,stockCountEntry:stockCountEntry,tradeEntry:tradeEntry,tierSetEntry:tierSetEntry,loanEntry:loanEntry,repaymentEntry:repaymentEntry,giftEntry:giftEntry,redeemEntry:redeemEntry,rebateOffsetEntry:rebateOffsetEntry,addIdEntry:addIdEntry,renameEntry:renameEntry,placeEntry:placeEntry,txPrice:txPrice,txOwed:txOwed,txPaid:txPaid,txCost:txCost,txUnitCost:txUnitCost,txDeliv:txDeliv,txPhys:txPhys,txEffDeliv:txEffDeliv,txAdvance:txAdvance,txWrittenOff:txWrittenOff,txUnpaidSince:txUnpaidSince,txHandSteps:txHandSteps,payDelays:payDelays,lateOffer:lateOffer,
        txDeferUnits:txDeferUnits,txPendUnits:txPendUnits,txPendUnitsRaw:txPendUnitsRaw,txPendRM:txPendRM,txStat:txStat,txDates:txDates,txGoods:txGoods,closeGoods:closeGoods,
        poRecvUnits:poRecvUnits,poCash:poCash,poLive:poLive,poOwed:poOwed,poRate:poRate,poOpenUnits:poOpenUnits,poStat:poStat,provRate:provRate,saleProvRate:saleProvRate,saleLadder:saleLadder,saleProvSince:saleProvSince,SALE_FULL_DAYS:SALE_FULL_DAYS,
        daysBetween:daysBetween,dayAge:dayAge,walk:walk,lotAlloc:lotAlloc,stockBasis:stockBasis,latestCogs:latestCogs,coverStats:coverStats,restockPlan:restockPlan,commitments:commitments,
        ledgerRow:ledgerRow,openable:openable,ovKey:ovKey,ovRekey:ovRekey,attributionOf:attributionOf,correctionFaults:correctionFaults,payFault:payFault,refundOnCancel:refundOnCancel,
        CORRECTABLE:CORRECTABLE,CORRECT_REQUIRED:CORRECT_REQUIRED,CORRECT_NUM_POS:CORRECT_NUM_POS,
        CORRECT_NUM_NN:CORRECT_NUM_NN,CORRECT_DATE:CORRECT_DATE,CORRECT_BOOL:CORRECT_BOOL,
        CORRECT_CODE:CORRECT_CODE,CORRECT_TEXT:CORRECT_TEXT,HANDOVER:HANDOVER,
        ADDID_APPOINTS:ADDID_APPOINTS,BUCKET_SFX:BUCKET_SFX,isBucket:isBucket,ownerCode:ownerCode,ownsCode:ownsCode,partyOwedRM:partyOwedRM,appointBucket:appointBucket,bookR2:bookR2,claimAlloc:claimAlloc,TRIP_RE:TRIP_RE,tripRows:tripRows,tripFault:tripFault,
        vaultPendingOk:vaultPendingOk,vaultRekeyMap:vaultRekeyMap,vaultMapMerge:vaultMapMerge,renamePairs:renamePairs,renameInBook:renameInBook,placeKey:placeKey,placeBare:placeBare,placeCandidates:placeCandidates};
})();
export default POSITION_ENGINE;
